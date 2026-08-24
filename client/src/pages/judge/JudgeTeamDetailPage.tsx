import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { getApiErrorMessage } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';
import { useJudgeCriteria, useJudgeTeamDetail, useSaveDraftEvaluation, useSubmitEvaluation } from '../../hooks/useJudge';
import type { JudgeCriterion } from '../../types/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// VIEW opens the file in a new tab via a plain <a target="_blank"> — the
// same for every file type, PDF included. An inline <iframe> toggle was
// tried and found unreliable in production: Chrome's built-in PDF viewer
// running inside an <iframe> hits its own edge cases ("Failed to load PDF
// document") that a direct full-tab navigation to the exact same URL
// doesn't. DOWNLOAD uses its own separately pre-signed downloadUrl straight
// from the API response — never fileUrl with a download flag spliced in
// client-side, since for pitch decks/documents (Cloudinary "authenticated"
// delivery) that would invalidate the server's signature. Neither VIEW nor
// DOWNLOAD fetches anything client-side, so neither depends on Cloudinary's
// CORS configuration, and a plain anchor click is never subject to a popup
// blocker (unlike a scripted window.open()).
function FileActions({ fileUrl, downloadUrl }: { fileUrl: string; downloadUrl: string }) {
  return (
    <div className="flex gap-2 shrink-0">
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs px-2 py-1 rounded-lg border-2 border-ink bg-white hover:bg-cream text-forest font-black uppercase"
      >
        VIEW
      </a>
      <a
        href={downloadUrl}
        className="text-xs px-2 py-1 rounded-lg border-2 border-ink bg-white hover:bg-cream text-crimson font-black uppercase"
      >
        DOWNLOAD
      </a>
    </div>
  );
}

export function JudgeTeamDetailPage() {
  const { teamId = null } = useParams<{ teamId: string }>();
  const criteria = useJudgeCriteria();
  const detail = useJudgeTeamDetail(teamId);
  const saveDraft = useSaveDraftEvaluation(teamId ?? '');
  const submitEvaluation = useSubmitEvaluation(teamId ?? '');

  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [comments, setComments] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  if (detail.isLoading || criteria.isLoading) return <LoadingState label="Loading team…" />;
  if (detail.error) return <ErrorState message={getApiErrorMessage(detail.error)} onRetry={() => detail.refetch()} />;
  if (!detail.data || !criteria.data) return null;

  const team = detail.data;
  const isSubmitted = team.myEvaluation.status === 'SUBMITTED';

  const effectiveScores =
    scores ??
    team.myEvaluation.scores ??
    Object.fromEntries(criteria.data.criteria.map((c) => [c.id, Math.round((c.min + c.max) / 2)]));
  const effectiveComments = comments ?? team.myEvaluation.comments ?? '';

  const total = criteria.data.criteria.reduce((sum, c) => sum + (effectiveScores[c.id] ?? 0), 0);

  const scoreErrors: Record<string, string> = {};
  for (const c of criteria.data.criteria) {
    const v = effectiveScores[c.id];
    if (v === undefined || v < c.min || v > c.max || !Number.isInteger(v)) {
      scoreErrors[c.id] = `Must be an integer between ${c.min} and ${c.max}.`;
    }
  }
  const hasErrors = Object.keys(scoreErrors).length > 0;

  function setScore(criterion: JudgeCriterion, value: number) {
    setScores({ ...effectiveScores, [criterion.id]: value });
  }

  function submitPayload() {
    return { scores: effectiveScores, comments: effectiveComments || undefined };
  }

  return (
    <div className="flex flex-col gap-6" data-testid="judge-team-detail">
      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <p className="text-forest font-black text-xs tracking-wide uppercase">TEAM</p>
        <h1 className="text-2xl font-black text-ink">{team.name}</h1>
        <p className="text-crimson font-black uppercase text-sm">{team.category}</p>
        <p className="text-sm font-bold text-navy mt-2">CEO: {team.ceo.name}</p>
        <p className="text-sm font-bold text-navy">{team.memberCount} / 5 MEMBERS</p>
      </section>

      <section className="comic-panel p-6" data-testid="judge-members-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>TEAM MEMBERS</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-ink font-bold">
              <Badge tone="neutral">{m.department}</Badge>
              {m.name}
              {m.isCeo && <span title="CEO">👑</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="comic-panel p-6" data-testid="judge-project-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-forest" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>PROJECT</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {[
            ['Title', team.project.title],
            ['Problem Statement', team.project.problemStatement],
            ['Proposed Solution', team.project.proposedSolution],
            ['Target Users', team.project.targetUsers],
            ['Technology Stack', team.project.technologyStack],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-forest text-xs uppercase font-black">{label}</dt>
              <dd className="text-ink mt-0.5 font-medium">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="comic-panel p-6" data-testid="judge-deliverables-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>DELIVERABLES</h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink font-bold">
              Pitch Deck{team.deliverables.pitchDeck.status === 'UPLOADED' ? ` (v${team.deliverables.pitchDeck.version})` : ''}
            </span>
            {team.deliverables.pitchDeck.status === 'UPLOADED' ? (
              <FileActions fileUrl={team.deliverables.pitchDeck.fileUrl} downloadUrl={team.deliverables.pitchDeck.downloadUrl} />
            ) : (
              <span className="text-navy/40 text-xs font-bold">Not uploaded</span>
            )}
          </div>
          {team.deliverables.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2">
              <span className="text-ink font-bold">
                {d.filename} ({formatBytes(d.size)})
              </span>
              <FileActions fileUrl={d.fileUrl} downloadUrl={d.downloadUrl} />
            </div>
          ))}
          {team.deliverables.assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <span className="text-ink font-bold">
                {a.filename} ({formatBytes(a.size)})
              </span>
              <FileActions fileUrl={a.fileUrl} downloadUrl={a.downloadUrl} />
            </div>
          ))}
          {team.deliverables.documents.length === 0 && team.deliverables.assets.length === 0 && (
            <p className="text-navy/40 text-xs font-bold">No documents or assets uploaded.</p>
          )}
        </div>
      </section>

      <section className="comic-panel p-6" data-testid="judge-criteria-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-crimson" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>JUDGING</h2>

        {isSubmitted && (
          <div className="mb-4 rounded-lg bg-lime/40 border-[3px] border-ink px-4 py-3 shadow-[3px_3px_0px_#111111]" data-testid="judge-submitted-banner">
            <p className="text-forest font-black text-sm uppercase">EVALUATION SUBMITTED</p>
            <p className="text-xs font-bold text-navy mt-1">
              Submitted: {team.myEvaluation.submittedAt ? new Date(team.myEvaluation.submittedAt).toLocaleString() : '—'}
            </p>
            <p className="text-xs font-bold text-navy">TOTAL SCORE: {team.myEvaluation.total}</p>
            <p className="text-xs text-navy/60 mt-2">This evaluation has been submitted and cannot be modified.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {criteria.data.criteria.map((c) => (
            <div key={c.id}>
              <label className="text-sm text-ink flex flex-col gap-1">
                <span className="font-black uppercase">
                  {c.label} <span className="text-navy/50 font-normal normal-case">(max {c.max})</span>
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    value={effectiveScores[c.id] ?? c.min}
                    disabled={isSubmitted}
                    onChange={(e) => setScore(c, Number(e.target.value))}
                    className="w-full accent-crimson disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min={c.min}
                    max={c.max}
                    step={1}
                    value={effectiveScores[c.id] ?? ''}
                    disabled={isSubmitted}
                    data-testid={`judge-score-${c.id}`}
                    onChange={(e) => setScore(c, Number(e.target.value))}
                    className="w-16 shrink-0 rounded-lg bg-white border-[3px] border-ink px-2 py-1 text-center text-ink font-bold disabled:opacity-50"
                  />
                </div>
              </label>
              {scoreErrors[c.id] && (
                <p className="text-xs font-bold text-crimson mt-1" data-testid={`judge-score-error-${c.id}`}>
                  {scoreErrors[c.id]}
                </p>
              )}
            </div>
          ))}
        </div>

        <label className="text-sm text-ink font-black uppercase flex flex-col gap-1 mt-4">
          Comments
          <textarea
            value={effectiveComments}
            disabled={isSubmitted}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="rounded-lg bg-white border-[3px] border-ink px-2 py-1.5 text-sm text-ink font-medium normal-case disabled:opacity-50"
          />
        </label>

        <p className="text-ink font-black mt-4" data-testid="judge-total-score">
          TOTAL SCORE: {total} / {criteria.data.maxTotal}
        </p>

        {!isSubmitted && (
          <div className="flex gap-3 mt-4">
            <button
              data-testid="judge-save-draft-button"
              disabled={saveDraft.isPending || hasErrors}
              onClick={() => saveDraft.mutate(submitPayload())}
              className={comicButton('white')}
            >
              {saveDraft.isPending ? 'Saving…' : 'SAVE DRAFT'}
            </button>
            <button
              data-testid="judge-submit-button"
              disabled={submitEvaluation.isPending || hasErrors}
              onClick={() => setConfirmSubmit(true)}
              className={comicButton('crimson')}
            >
              SUBMIT EVALUATION
            </button>
          </div>
        )}

        {saveDraft.isSuccess && !saveDraft.isPending && (
          <p className="text-xs font-bold text-forest mt-2" data-testid="judge-draft-saved">
            Draft saved.
          </p>
        )}
        {saveDraft.isError && <p className="text-xs font-bold text-crimson mt-2">{getApiErrorMessage(saveDraft.error)}</p>}
        {submitEvaluation.isError && (
          <p className="text-xs font-bold text-crimson mt-2" data-testid="judge-submit-error">
            {getApiErrorMessage(submitEvaluation.error)}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit this evaluation?"
        description="Once submitted, scores cannot be changed."
        confirmLabel="Submit"
        pending={submitEvaluation.isPending}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() => {
          submitEvaluation.mutate(submitPayload());
          setConfirmSubmit(false);
        }}
      />
    </div>
  );
}
