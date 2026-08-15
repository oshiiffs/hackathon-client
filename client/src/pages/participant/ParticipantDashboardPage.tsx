import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { EditableNameField } from '../../components/EditableNameField';
import { PhaseProgress } from '../../components/PhaseProgress';
import { ProfileEditor } from '../../components/ProfileEditor';
import { LoadingState } from '../../components/StateViews';
import { useHackathonState } from '../../hooks/useHackathon';
import { useMyTeam } from '../../hooks/useTeam';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/apiClient';

export function ParticipantDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { data: state, isLoading: stateLoading } = useHackathonState();
  const { data: team } = useMyTeam(Boolean(user?.drafted));

  // Poll /auth/me right after a challenge round resolves, so a winning candidate
  // gets redirected to the CEO flow the moment the server promotes their role.
  useEffect(() => {
    if (state?.phase !== 'DRAFTING') return;
    let cancelled = false;
    apiClient
      .get('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        // Best-effort background poll — a regular refetch/socket update will
        // reconcile state on the next tick regardless.
      });
    return () => {
      cancelled = true;
    };
  }, [state?.phase, setUser]);

  if (!user) return null;
  if (user.role === 'CEO') return <Navigate to="/ceo" replace />;
  if (user.drafted && team) return <Navigate to="/team" replace />;

  const phase = state?.phase;
  // The device lock is independent of `phase` — the admin can lock/unlock at
  // will. When locked, always show the standby screen no matter what phase
  // says; only once unlocked does the phase decide what to show.
  const locked = state?.participantsLocked ?? true;
  const hasRunAChallengeRound = (state?.currentChallengeRound ?? 0) > 0;

  // The CEO challenge experience lives on its own route.
  if (state && !locked && phase === 'CEO_CHALLENGE_ACTIVE') {
    return <Navigate to="/participant/challenge" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PhaseProgress currentPhase={phase} />

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">My status</h2>
          <Link to="/participant/directory" className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition">
            View all participants →
          </Link>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Name</dt>
            <EditableNameField currentName={user.fullName} />
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Department</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{user.homeDepartment}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Current status</dt>
            <dd className="mt-0.5">
              <Badge tone="primary">{user.drafted ? 'On a team' : 'Candidate'}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Drafted status</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{user.drafted ? 'Drafted' : 'Not yet drafted'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">CEO status</dt>
            <dd className="text-slate-100 font-medium mt-0.5">Not currently a CEO</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase font-semibold">Challenge state</dt>
            <dd className="text-slate-100 font-medium mt-0.5">{stateLoading ? '…' : (state?.phaseLabel ?? 'Unknown')}</dd>
          </div>
        </dl>
      </section>

      <ProfileEditor user={user} />

      <section className="flex flex-col items-center justify-center gap-8 py-6">
        {stateLoading && !state && <LoadingState label="Loading event state…" />}

        {state && locked && (
          <div className="text-center" data-testid="waiting-screen">
            <div className="w-3 h-3 rounded-full bg-primary-500 mx-auto mb-4 animate-ping" />
            <h2 className="text-3xl font-black text-slate-100 tracking-tight">HACKATHON 2026</h2>
            <p className="text-xl font-bold text-slate-300 mt-2">PLEASE WAIT</p>
            <p className="text-slate-500 mt-2 max-w-sm">The challenge has not started.</p>
          </div>
        )}

        {state && !locked && phase !== 'CEO_CHALLENGE_ACTIVE' && (
          <div className="text-center flex flex-col items-center gap-4" data-testid="candidate-screen">
            {hasRunAChallengeRound && (
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">CHALLENGE ENDED</p>
            )}
            <h2 className="text-xl font-bold text-slate-100">Candidate Mode</h2>
            <p className="text-slate-400 max-w-sm">
              {hasRunAChallengeRound
                ? "You didn't win this round's CEO challenge and can no longer submit yourself as CEO. "
                : ''}
              Show your QR code to a CEO to get recruited onto their team.
            </p>
            <Link
              to="/participant/qr"
              className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 text-sm transition"
            >
              View My QR Code
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
