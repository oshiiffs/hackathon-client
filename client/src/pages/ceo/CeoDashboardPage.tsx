import { Link, Navigate } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { Badge } from '../../components/Badge';
import { TeamRosterGrid } from '../../components/TeamRosterGrid';
import { useMyTeam } from '../../hooks/useTeam';
import { useHackathonState } from '../../hooks/useHackathon';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../lib/apiClient';

/**
 * CEO dashboard. Department selection happens on a dedicated one-time page
 * (/ceo/department) — this dashboard redirects there until that's done, then
 * shows the roster and the next recruitment step. QR-based recruitment itself
 * is a later phase; this only shows the "next step" prompt for it.
 */
export function CeoDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: team, isLoading, error, refetch } = useMyTeam();
  const { data: hackathonState } = useHackathonState();

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !team) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  const me = team.members.find((m) => m.id === team.ceoId);
  const hasChosenDepartment = Boolean(me?.slotDepartment);

  if (!hasChosenDepartment) {
    return <Navigate to="/ceo/department" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-lg font-bold text-slate-100">{team.name ?? 'Your team (not yet named)'}</h2>
          <Badge tone="gold">CEO</Badge>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">CEO</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{user?.fullName ?? me?.fullName}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Hackathon phase</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{hackathonState?.phaseLabel ?? '…'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Department</dt>
            <dd className="text-slate-100 font-medium mt-0.5" data-testid="ceo-assigned-department">
              {me?.slotDepartment}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Finalized</dt>
            <dd className="mt-0.5">
              <Badge tone={team.finalizedAt ? 'primary' : 'neutral'}>{team.finalizedAt ? 'Yes' : 'Not yet'}</Badge>
            </dd>
          </div>
        </dl>

        <TeamRosterGrid team={team} />

        {!team.isComplete && (
          <div className="mt-5 rounded-xl border border-accent-700 bg-accent-950/40 px-4 py-3 flex flex-col items-start gap-3">
            <p className="text-accent-300 font-bold text-sm">NEXT STEP: Recruit the remaining four departments using QR</p>
            <Link
              to="/ceo/recruit"
              className="rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-black px-4 py-2 text-sm transition"
            >
              SCAN MEMBER
            </Link>
          </div>
        )}

        {team.isComplete && !team.finalizedAt && (
          <div className="mt-5 rounded-xl border border-primary-700 bg-primary-950/40 px-4 py-3 flex flex-col items-start gap-3">
            <p className="text-primary-300 font-bold text-sm">TEAM COMPLETE — NEXT: FINALIZE TEAM</p>
            <Link
              to="/ceo/team/finalize"
              className="rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-black px-4 py-2 text-sm transition"
            >
              FINALIZE TEAM
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
