import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { getApiErrorMessage } from '../../lib/apiClient';
import { useJudgeCriteria, useJudgeTeamDetail, useSaveDraftEvaluation, useSubmitEvaluation } from '../../hooks/useJudge';
import type { JudgeCriterion } from '../../types/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-primary-400 font-black text-xs tracking-wide">TEAM</p>
        <h1 className="text-2xl font-black text-slate-100">{team.name}</h1>
        <p className="text-accent-400 font-semibold text-sm">{team.category}</p>
        <p className="text-sm text-slate-400 mt-2">CEO: {team.ceo.name}</p>
        <p className="text-sm text-slate-400">
          {team.memberCount} / 5 MEMBERS
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="judge-members-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">TEAM MEMBERS</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-slate-200">
              <Badge tone="neutral">{m.department}</Badge>
              {m.name}
              {m.isCeo && <span title="CEO">👑</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="judge-project-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">PROJECT</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {[
            ['Title', team.project.title],
            ['Problem Statement', team.project.problemStatement],
            ['Proposed Solution', team.project.proposedSolution],
            ['Target Users', team.project.targetUsers],
            ['Technology Stack', team.project.technologyStack],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500 text-xs uppercase font-semibold">{label}</dt>
              <dd className="text-slate-100 mt-0.5">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="judge-deliverables-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">DELIVERABLES</h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">
              Pitch Deck{team.deliverables.pitchDeck.status === 'UPLOADED' ? ` (v${team.deliverables.pitchDeck.version})` : ''}
            </span>
            {team.deliverables.pitchDeck.status === 'UPLOADED' ? (
              <a
                href={team.deliverables.pitchDeck.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-primary-400"
              >
                VIEW
              </a>
            ) : (
              <span className="text-slate-500 text-xs">Not uploaded</span>
            )}
          </div>
          {team.deliverables.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between">
              <span className="text-slate-300">
                {d.filename} ({formatBytes(d.size)})
              </span>
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-primary-400">
                VIEW
              </a>
            </div>
          ))}
          {team.deliverables.assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between">
              <span className="text-slate-300">
                {a.filename} ({formatBytes(a.size)})
              </span>
              <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-primary-400">
                VIEW
              </a>
            </div>
          ))}
          {team.deliverables.documents.length === 0 && team.deliverables.assets.length === 0 && (
            <p className="text-slate-500 text-xs">No documents or assets uploaded.</p>
          )}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="judge-criteria-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">JUDGING</h2>

        {isSubmitted && (
          <div className="mb-4 rounded-lg bg-primary-500/10 border border-primary-600/40 px-4 py-3" data-testid="judge-submitted-banner">
            <p className="text-primary-300 font-bold text-sm">EVALUATION SUBMITTED</p>
            <p className="text-xs text-slate-400 mt-1">
              Submitted: {team.myEvaluation.submittedAt ? new Date(team.myEvaluation.submittedAt).toLocaleString() : '—'}
            </p>
            <p className="text-xs text-slate-400">TOTAL SCORE: {team.myEvaluation.total}</p>
            <p className="text-xs text-slate-500 mt-2">This evaluation has been submitted and cannot be modified.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {criteria.data.criteria.map((c) => (
            <div key={c.id}>
              <label className="text-sm text-slate-300 flex flex-col gap-1">
                <span className="font-semibold">
                  {c.label} ({effectiveScores[c.id]}/{c.max})
                </span>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  value={effectiveScores[c.id] ?? c.min}
                  disabled={isSubmitted}
                  data-testid={`judge-score-${c.id}`}
                  onChange={(e) => setScore(c, Number(e.target.value))}
                  className="w-full disabled:opacity-50"
                />
              </label>
              {scoreErrors[c.id] && (
                <p className="text-xs text-red-400 mt-1" data-testid={`judge-score-error-${c.id}`}>
                  {scoreErrors[c.id]}
                </p>
              )}
            </div>
          ))}
        </div>

        <label className="text-sm text-slate-300 flex flex-col gap-1 mt-4">
          Comments
          <textarea
            value={effectiveComments}
            disabled={isSubmitted}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-50"
          />
        </label>

        <p className="text-slate-100 font-bold mt-4" data-testid="judge-total-score">
          TOTAL SCORE: {total} / {criteria.data.maxTotal}
        </p>

        {!isSubmitted && (
          <div className="flex gap-3 mt-4">
            <button
              data-testid="judge-save-draft-button"
              disabled={saveDraft.isPending || hasErrors}
              onClick={() => saveDraft.mutate(submitPayload())}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-semibold px-4 py-2 text-sm"
            >
              {saveDraft.isPending ? 'Saving…' : 'SAVE DRAFT'}
            </button>
            <button
              data-testid="judge-submit-button"
              disabled={submitEvaluation.isPending || hasErrors}
              onClick={() => setConfirmSubmit(true)}
              className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold px-4 py-2 text-sm"
            >
              SUBMIT EVALUATION
            </button>
          </div>
        )}

        {saveDraft.isSuccess && !saveDraft.isPending && (
          <p className="text-xs text-primary-400 mt-2" data-testid="judge-draft-saved">
            Draft saved.
          </p>
        )}
        {saveDraft.isError && <p className="text-xs text-red-400 mt-2">{getApiErrorMessage(saveDraft.error)}</p>}
        {submitEvaluation.isError && <p className="text-xs text-red-400 mt-2" data-testid="judge-submit-error">{getApiErrorMessage(submitEvaluation.error)}</p>}
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
