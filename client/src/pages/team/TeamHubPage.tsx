import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { Badge } from '../../components/Badge';
import { PhaseProgress } from '../../components/PhaseProgress';
import { TeamRosterGrid } from '../../components/TeamRosterGrid';
import { ProjectSection } from './ProjectSection';
import { DeliverablesSection } from './DeliverablesSection';
import { AiMentorPanel } from './AiMentorPanel';
import { useTeamOverview, useRenameTeam, useTeamFeedback } from '../../hooks/useTeamHub';
import { useHackathonState } from '../../hooks/useHackathon';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import type { Team, TeamOverview } from '../../types/api';

/** CEO-only inline rename control — team.name is set once at finalization but
 * the CEO can still fix a typo or reconsider it afterward via PATCH /team/name. */
function TeamNameField({ name, canRename }: { name: string | null; canRename: boolean }) {
  const renameTeam = useRenameTeam();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? '');

  if (!canRename) {
    return <dd className="text-slate-100 font-medium mt-0.5">{name}</dd>;
  }

  if (!editing) {
    return (
      <dd className="flex items-center gap-2 mt-0.5">
        <span className="text-slate-100 font-medium">{name}</span>
        <button
          type="button"
          onClick={() => {
            setValue(name ?? '');
            setEditing(true);
          }}
          className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition"
        >
          Rename
        </button>
      </dd>
    );
  }

  return (
    <dd className="mt-0.5">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = value.trim();
          if (!trimmed || trimmed === name) {
            setEditing(false);
            return;
          }
          renameTeam.mutate(trimmed, { onSuccess: () => setEditing(false) });
        }}
      >
        <input
          autoFocus
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100"
        />
        <button
          type="submit"
          disabled={renameTeam.isPending || value.trim().length === 0}
          className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition"
        >
          {renameTeam.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={renameTeam.isPending}
          onClick={() => setEditing(false)}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 transition"
        >
          Cancel
        </button>
      </form>
      {renameTeam.isError && <p className="text-red-400 text-xs mt-1">{getApiErrorMessage(renameTeam.error)}</p>}
    </dd>
  );
}

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
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="team-feedback-section">
      <h2 className="text-lg font-bold text-slate-100 mb-4">JUDGE FEEDBACK</h2>
      <div className="flex flex-col gap-4">
        {feedback.evaluations.map((evaluation) => (
          <div key={evaluation.judgeLabel} className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-slate-100">{evaluation.judgeLabel}</p>
              <Badge tone="gold">
                {evaluation.total} / {evaluation.maxTotal}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
              {evaluation.scores.map((s) => (
                <div key={s.id}>
                  <p className="text-slate-500 uppercase font-semibold">{s.label}</p>
                  <p className="text-slate-100 font-bold">{s.value}</p>
                </div>
              ))}
            </div>
            {evaluation.comments && <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{evaluation.comments}</p>}
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

  if (isLoading) return <LoadingState label="Loading your team…" />;

  if (error) {
    if (getApiErrorCode(error) === 'TEAM_ACCESS_DENIED') {
      return (
        <div className="flex flex-col items-center gap-2 py-16 text-center" data-testid="no-team-state">
          <p className="text-slate-200 font-semibold">You&apos;re not on a team yet</p>
          <p className="text-sm text-slate-500 max-w-sm">
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
      <div className="flex flex-col items-center gap-4 py-10 text-center" data-testid="recruited-screen">
        <p className="text-5xl">🎉</p>
        <h2 className="text-2xl font-black text-primary-400">YOU HAVE BEEN RECRUITED</h2>
        <div className="text-sm">
          <p className="text-slate-500 text-xs uppercase font-semibold">Team</p>
          <p className="text-slate-100 font-bold mt-0.5">{overview.team.name ?? 'Your team (not yet named)'}</p>
        </div>
        <div className="text-sm">
          <p className="text-slate-500 text-xs uppercase font-semibold">Department</p>
          <p className="text-slate-100 font-bold mt-0.5">{me?.department ?? '—'}</p>
        </div>
        <div className="text-sm">
          <p className="text-slate-500 text-xs uppercase font-semibold">CEO</p>
          <p className="text-slate-100 font-bold mt-0.5">{overview.ceo.name}</p>
        </div>

        <div className="flex items-center gap-2 mt-2 text-primary-400" data-testid="recruited-waiting-indicator">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <p className="text-sm font-semibold">
            {overview.team.memberCount} / {overview.team.maxMembers} members recruited so far
          </p>
        </div>
        <p className="text-slate-500 text-xs max-w-sm">
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

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-primary-400 font-black text-xs tracking-wide">TEAM FINALIZED</p>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
          <div>
            <h1 className="text-2xl font-black text-slate-100">{overview.team.name}</h1>
            <p className="text-accent-400 font-semibold text-sm" data-testid="team-heat-category">
              {overview.team.category}
            </p>
          </div>
          <Badge tone="gold">CEO: {overview.ceo.name}</Badge>
        </div>
        <p className="text-sm text-slate-400 mt-2" data-testid="member-count-header">
          {overview.team.memberCount} / {overview.team.maxMembers} MEMBERS
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="team-overview-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">TEAM OVERVIEW</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Team Name</dt>
            <TeamNameField name={overview.team.name} canRename={user?.role === 'CEO'} />
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">HEAT Category</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{overview.team.category}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">CEO</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{overview.ceo.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Member Count</dt>
            <dd className="text-slate-100 font-medium mt-0.5">
              {overview.team.memberCount} / {overview.team.maxMembers}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Team Status</dt>
            <dd className="mt-0.5">
              <Badge tone="primary">{overview.team.status}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Created At</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{new Date(overview.team.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Finalized At</dt>
            <dd className="text-slate-100 font-medium mt-0.5">
              {overview.team.finalizedAt ? new Date(overview.team.finalizedAt).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="team-roster-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">TEAM ROSTER</h2>
        <TeamRosterGrid team={rosterTeam} />
      </section>

      <ProjectSection project={overview.project} />

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="project-status-section">
        <h2 className="text-lg font-bold text-slate-100 mb-4">PROJECT STATUS</h2>
        <Badge tone="gold">{overview.submission.status.replace(/_/g, ' ')}</Badge>
      </section>

      <DeliverablesSection ceoId={overview.ceo.id} />
      <TeamFeedbackSection enabled={hackathonState?.phase === 'COMPLETE'} />
      <AiMentorPanel />
    </div>
  );
}
