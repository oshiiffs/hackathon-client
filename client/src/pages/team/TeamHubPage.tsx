import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PhaseProgress } from '../../components/PhaseProgress';
import { TeamRosterGrid } from '../../components/TeamRosterGrid';
import { ProjectSection } from './ProjectSection';
import { DeliverablesSection } from './DeliverablesSection';
import { AiMentorPanel } from './AiMentorPanel';
import { useTeamOverview, useTeamFeedback, useSubmitDeliverable } from '../../hooks/useTeamHub';
import { useHackathonState } from '../../hooks/useHackathon';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';
import type { Team, TeamOverview } from '../../types/api';

/** Adapts the Team Hub overview shape into the existing TeamRosterGrid's
 * `Team` prop contract (id/ceoId/members[].slotDepartment|fullName|id) so
 * that component — already shared with the CEO department/dashboard pages —
 * doesn't need to know about two different roster shapes. */
function toRosterTeam(overview: TeamOverview): Team {
  return {
    id: overview.team.id,
    name: overview.team.name,
    ceoId: overview.ceo.id,
    ceo: {
      id: overview.ceo.id,
      fullName: overview.ceo.name,
      nickname: overview.ceo.nickname,
      avatarUrl: overview.ceo.avatarUrl,
      homeDepartment: 'COE',
      slotDepartment: null,
      role: 'CEO',
    },
    members: overview.members.map((m) => ({
      id: m.id,
      fullName: m.name,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl,
      homeDepartment: m.department ?? 'COE',
      slotDepartment: m.department,
      role: m.isCeo ? 'CEO' : 'PARTICIPANT',
    })),
    category: overview.team.category,
    isComplete: overview.team.memberCount === overview.team.maxMembers,
    finalizedAt: overview.team.finalizedAt,
    deliverable: null,
    createdAt: overview.team.createdAt,
  };
}

/** Judge scores/comments, once the event is COMPLETE. The backend gates this
 * itself (returns `available: false` before then) — `enabled` here just
 * avoids firing the request at all on every other phase. */
function TeamFeedbackSection({ enabled }: { enabled: boolean }) {
  const { data: feedback } = useTeamFeedback(enabled);
  if (!enabled || !feedback?.available || feedback.evaluations.length === 0) return null;

  return (
    <section className="comic-panel p-6" data-testid="team-feedback-section">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
      <h2 className={`text-lg mb-4 ${comicHeading}`}>JUDGE FEEDBACK</h2>
      <div className="flex flex-col gap-4">
        {feedback.evaluations.map((evaluation) => (
          <div key={evaluation.judgeLabel} className="bg-white border-[3px] border-ink rounded-lg p-4 shadow-[3px_3px_0px_#111111]">
            <div className="flex items-center justify-between mb-2">
              <p className="font-black text-ink">{evaluation.judgeLabel}</p>
              <Badge tone="gold">
                {evaluation.total} / {evaluation.maxTotal}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
              {evaluation.scores.map((s) => (
                <div key={s.id}>
                  <p className="text-forest uppercase font-black">{s.label}</p>
                  <p className="text-ink font-black">{s.value}</p>
                </div>
              ))}
            </div>
            {evaluation.comments && <p className="text-sm text-navy mt-2 whitespace-pre-wrap">{evaluation.comments}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function TeamHubPage() {
  const user = useAuthStore((s) => s.user);
  const { data: overview, isLoading, error, refetch } = useTeamOverview();
  const { data: hackathonState } = useHackathonState();
  const submitDeliverable = useSubmitDeliverable();
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  if (isLoading) return <LoadingState label="Loading your team…" />;

  if (error) {
    if (getApiErrorCode(error) === 'TEAM_ACCESS_DENIED') {
      return (
        <div className="flex flex-col items-center gap-2 py-16 text-center" data-testid="no-team-state">
          <p className="text-ink font-black uppercase">You&apos;re not on a team yet</p>
          <p className="text-sm font-medium text-navy max-w-sm">
            Once you&apos;re recruited onto a team, your Team Hub will appear here.
          </p>
        </div>
      );
    }
    return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  }
  if (!overview) return null;

  // CEO-only team-management controls (recruit/department/finalize) live on
  // /ceo/* — before finalization, send the CEO there instead of showing a
  // half-finished Team Hub with no controls to complete it.
  if (user?.role === 'CEO' && overview.team.status !== 'FINALIZED') {
    return <Navigate to="/ceo" replace />;
  }

  if (overview.team.status !== 'FINALIZED') {
    const me = overview.members.find((m) => m.id === user?.id);
    return (
      <div className="comic-panel flex flex-col items-center gap-4 py-10 px-8 text-center max-w-lg mx-auto mt-6" data-testid="recruited-screen">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
        <p className="text-5xl">🎉</p>
        <h2 className="text-2xl font-black text-forest uppercase">YOU HAVE BEEN RECRUITED</h2>
        <div className="text-sm">
          <p className="text-forest text-xs uppercase font-black">Team</p>
          <p className="text-ink font-black mt-0.5">{overview.team.name ?? 'Your team (not yet named)'}</p>
        </div>
        <div className="text-sm">
          <p className="text-forest text-xs uppercase font-black">Department</p>
          <p className="text-ink font-black mt-0.5">{me?.department ?? '—'}</p>
        </div>
        <div className="text-sm">
          <p className="text-forest text-xs uppercase font-black">CEO</p>
          <p className="text-ink font-black mt-0.5">{overview.ceo.name}</p>
        </div>

        <div className="flex items-center gap-2 mt-2 text-forest" data-testid="recruited-waiting-indicator">
          <span className="w-2.5 h-2.5 rounded-full bg-crimson border border-ink animate-pulse" />
          <p className="text-sm font-black uppercase">
            {overview.team.memberCount} / {overview.team.maxMembers} members recruited so far
          </p>
        </div>
        <p className="text-navy text-xs max-w-sm">
          Your CEO is still recruiting the rest of the team. This page updates automatically — no need to refresh, and
          nothing else to do here yet.
        </p>
      </div>
    );
  }

  const rosterTeam = toRosterTeam(overview);

  return (
    <div className="flex flex-col gap-6" data-testid="team-hub">
      <PhaseProgress currentPhase={hackathonState?.phase} />

      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <p className="text-forest font-black text-xs tracking-wide uppercase">TEAM FINALIZED</p>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
          <div>
            <h1 className="text-2xl font-black text-ink">{overview.team.name}</h1>
            <p className="text-crimson font-black uppercase text-sm" data-testid="team-heat-category">
              {overview.team.category}
            </p>
          </div>
          <Badge tone="gold">CEO: {overview.ceo.name}</Badge>
        </div>
        <p className="text-sm font-bold text-navy mt-2" data-testid="member-count-header">
          {overview.team.memberCount} / {overview.team.maxMembers} MEMBERS
        </p>
      </section>

      <section className="comic-panel p-6" data-testid="team-overview-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>TEAM OVERVIEW</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-forest text-xs uppercase font-black">Team Name</dt>
            {/* Permanent once finalized — see the caution on the CEO finalize screen.
                No rename control here on purpose. */}
            <dd className="text-ink font-bold mt-0.5">{overview.team.name}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">HEAT Category</dt>
            <dd className="text-ink font-bold mt-0.5">{overview.team.category}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">CEO</dt>
            <dd className="text-ink font-bold mt-0.5">{overview.ceo.name}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Member Count</dt>
            <dd className="text-ink font-bold mt-0.5">
              {overview.team.memberCount} / {overview.team.maxMembers}
            </dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Team Status</dt>
            <dd className="mt-0.5">
              <Badge tone="success">{overview.team.status}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Created At</dt>
            <dd className="text-ink font-bold mt-0.5">{new Date(overview.team.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Finalized At</dt>
            <dd className="text-ink font-bold mt-0.5">
              {overview.team.finalizedAt ? new Date(overview.team.finalizedAt).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="comic-panel p-6" data-testid="team-roster-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-forest" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>TEAM ROSTER</h2>
        <TeamRosterGrid team={rosterTeam} />
      </section>

      <ProjectSection project={overview.project} />

      <section className="comic-panel p-6" data-testid="project-status-section">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-crimson" aria-hidden="true" />
        <h2 className={`text-lg mb-4 ${comicHeading}`}>PROJECT STATUS</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={overview.submission.status === 'SUBMITTED' ? 'success' : 'warning'}>
            {overview.submission.status.replace(/_/g, ' ')}
          </Badge>

          {overview.submission.status !== 'SUBMITTED' &&
            (user?.role === 'CEO' ? (
              <button
                data-testid="submit-project-button"
                disabled={hackathonState?.submissionsLocked || overview.deliverables.pitchDeck.status !== 'UPLOADED'}
                onClick={() => setConfirmSubmit(true)}
                className={comicButton('crimson', 'sm')}
              >
                Submit
              </button>
            ) : (
              <span className="text-xs font-bold text-navy">Only your CEO can submit.</span>
            ))}
        </div>

        {overview.submission.status !== 'SUBMITTED' && overview.deliverables.pitchDeck.status !== 'UPLOADED' && (
          <p className="text-xs font-medium text-navy mt-2">Upload a pitch deck below before you can submit.</p>
        )}
        {overview.submission.status !== 'SUBMITTED' && hackathonState?.submissionsLocked && (
          <p className="text-xs font-medium text-navy mt-2">Submissions are currently locked by the event admin.</p>
        )}
        {submitDeliverable.isError && <p className="text-xs font-bold text-crimson mt-2">{getApiErrorMessage(submitDeliverable.error)}</p>}
      </section>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit your project?"
        description="Your CEO can keep updating deliverables until admin locks submissions, but this marks the team as done."
        confirmLabel="Submit"
        pending={submitDeliverable.isPending}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() => {
          submitDeliverable.mutate();
          setConfirmSubmit(false);
        }}
      />

      <DeliverablesSection ceoId={overview.ceo.id} />
      <TeamFeedbackSection enabled={hackathonState?.phase === 'COMPLETE'} />
      <AiMentorPanel />
    </div>
  );
}
