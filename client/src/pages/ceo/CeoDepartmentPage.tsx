import { Navigate, Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { TeamRosterGrid } from '../../components/TeamRosterGrid';
import { useMyTeam, useAssignCeoDepartment } from '../../hooks/useTeam';
import { ALL_DEPARTMENTS, type Department } from '../../types/api';
import { getApiErrorMessage } from '../../lib/apiClient';

/**
 * One-time CEO department pick. The backend is the sole authority on whether
 * this is still allowed (phase gate, not-already-assigned) — this page just
 * reflects whatever /api/team/me currently says and redirects once a
 * department is already on file, rather than trying to track "have I picked
 * yet" as separate client state.
 */
export function CeoDepartmentPage() {
  const { data: team, isLoading, error, refetch } = useMyTeam();
  const assign = useAssignCeoDepartment();

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !team) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  const me = team.members.find((m) => m.id === team.ceoId);
  const alreadyAssigned = Boolean(me?.slotDepartment) && !assign.isSuccess;

  if (alreadyAssigned) {
    return <Navigate to="/ceo" replace />;
  }

  const assignedTeam = assign.data;

  if (assignedTeam) {
    const assignedMe = assignedTeam.members.find((m) => m.id === assignedTeam.ceoId);
    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center" data-testid="department-confirmed">
        <p className="text-5xl">👑</p>
        <h2 className="text-2xl font-black text-primary-400">DEPARTMENT ASSIGNED</h2>
        <p className="text-slate-300">
          {assignedMe?.fullName} —{' '}
          <span className="font-bold text-accent-400" data-testid="ceo-assigned-department">
            {assignedMe?.slotDepartment}
          </span>
        </p>
        <div className="w-full max-w-xl">
          <TeamRosterGrid team={assignedTeam} />
        </div>
        <Link
          to="/ceo"
          className="mt-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 text-sm transition"
        >
          Go to CEO dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center" data-testid="ceo-department-page">
      <h2 className="text-2xl font-black text-slate-100 tracking-tight">CEO ASSIGNMENT</h2>
      <p className="text-slate-300">Congratulations! You are the CEO.</p>
      <p className="text-slate-400 text-sm">Choose your department:</p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full max-w-2xl">
        {ALL_DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            data-testid={`department-button-${dept}`}
            disabled={assign.isPending}
            onClick={() => assign.mutate(dept as Department)}
            className="rounded-xl border border-primary-700 bg-slate-900 hover:bg-primary-950 disabled:opacity-50 px-4 py-6 text-lg font-black text-slate-100 transition"
          >
            {dept}
          </button>
        ))}
      </div>

      <p className="text-slate-500 text-xs max-w-md">
        Your selected department will be your position in the team.
      </p>

      {assign.isError && <p className="text-red-400 text-sm">{getApiErrorMessage(assign.error)}</p>}
    </div>
  );
}
