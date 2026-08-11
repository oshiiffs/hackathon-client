import { Navigate } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { Badge } from '../../components/Badge';
import { TeamRosterGrid } from '../../components/TeamRosterGrid';
import { ProjectSection } from './ProjectSection';
import { DeliverablesSection } from './DeliverablesSection';
import { AiMentorPanel } from './AiMentorPanel';
import { useTeamOverview } from '../../hooks/useTeamHub';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
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
    ceo: { id: overview.ceo.id, fullName: overview.ceo.name, homeDepartment: 'COE', slotDepartment: null, role: 'CEO' },
    members: overview.members.map((m) => ({
      id: m.id,
      fullName: m.name,
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

export function TeamHubPage() {
  const user = useAuthStore((s) => s.user);
  const { data: overview, isLoading, error, refetch } = useTeamOverview();

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
        <p className="text-slate-400 text-sm max-w-sm mt-2">You are now a member of this team.</p>
      </div>
    );
  }

  const rosterTeam = toRosterTeam(overview);

  return (
    <div className="flex flex-col gap-6" data-testid="team-hub">
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
            <dd className="text-slate-100 font-medium mt-0.5">{overview.team.name}</dd>
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
      <AiMentorPanel />
    </div>
  );
}
