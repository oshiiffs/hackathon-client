import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { EditableNameField } from '../../components/EditableNameField';
import { PhaseProgress } from '../../components/PhaseProgress';
import { ProfileEditor } from '../../components/ProfileEditor';
import { LoadingState } from '../../components/StateViews';
import { ParticipantDirectoryList } from './ParticipantDirectoryList';
import { useHackathonState } from '../../hooks/useHackathon';
import { useMyTeam } from '../../hooks/useTeam';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';

export function ParticipantDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { data: state, isLoading: stateLoading } = useHackathonState();
  const { data: team } = useMyTeam(Boolean(user?.drafted));
  const [showDirectory, setShowDirectory] = useState(false);

  // Poll /auth/me right after a challenge round resolves, so a winning candidate
  // gets redirected to the CEO flow the moment the server promotes their role.
  useEffect(() => {
    if (state?.phase !== 'DRAFTING') return;
    let cancelled = false;
    apiClient
      .get('/auth/me', { suppressAuthClear: true })
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

      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg ${comicHeading}`}>My status</h2>
          <button
            data-testid="open-directory-button"
            onClick={() => setShowDirectory(true)}
            className="text-xs font-black uppercase text-forest hover:text-crimson transition"
          >
            View all participants →
          </button>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-forest text-xs uppercase font-black">Name</dt>
            <EditableNameField currentName={user.fullName} />
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Department</dt>
            <dd className="text-ink font-bold mt-0.5">{user.homeDepartment}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Current status</dt>
            <dd className="mt-0.5">
              <Badge tone="primary">{user.drafted ? 'On a team' : 'Candidate'}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Drafted status</dt>
            <dd className="text-ink font-bold mt-0.5">{user.drafted ? 'Drafted' : 'Not yet drafted'}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">CEO status</dt>
            <dd className="text-ink font-bold mt-0.5">Not currently a CEO</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Challenge state</dt>
            <dd className="text-ink font-bold mt-0.5">{stateLoading ? '…' : (state?.phaseLabel ?? 'Unknown')}</dd>
          </div>
        </dl>
      </section>

      <ProfileEditor user={user} />

      <section className="flex flex-col items-center justify-center gap-8 py-6">
        {stateLoading && !state && <LoadingState label="Loading event state…" />}

        {state && locked && (
          <div className="comic-panel text-center px-10 py-8" data-testid="waiting-screen">
            <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
            <div className="w-3 h-3 rounded-full bg-crimson border-2 border-ink mx-auto mb-4 animate-ping" />
            <h2 className="text-3xl font-black text-ink tracking-tight uppercase">NEXUS MULTIVERSE 2026</h2>
            <p className="text-xl font-black text-crimson mt-2 uppercase">PLEASE WAIT</p>
            <p className="text-navy mt-2 max-w-sm font-medium">The challenge has not started.</p>
          </div>
        )}

        {state && !locked && phase !== 'CEO_CHALLENGE_ACTIVE' && (
          <div className="comic-panel text-center flex flex-col items-center gap-4 px-10 py-8" data-testid="candidate-screen">
            <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-forest" aria-hidden="true" />
            {hasRunAChallengeRound && <p className="text-sm font-black uppercase tracking-wide text-navy/60">CHALLENGE ENDED</p>}
            <h2 className="text-xl font-black text-ink uppercase">Candidate Mode</h2>
            <p className="text-navy max-w-sm font-medium">
              {hasRunAChallengeRound
                ? "You didn't win this round's CEO challenge and can no longer submit yourself as CEO. "
                : ''}
              Show your QR code to a CEO to get recruited onto their team.
            </p>
            <Link to="/participant/qr" className={comicButton('crimson')}>
              View My QR Code
            </Link>
          </div>
        )}
      </section>

      {showDirectory && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDirectory(false)}
        >
          <div
            className="comic-panel w-full max-w-5xl max-h-full flex flex-col p-6"
            style={{ boxShadow: '8px 8px 0px #111111' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="participant-directory-modal"
          >
            <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className={`text-lg ${comicHeading}`}>Participants</h2>
                <p className="text-xs font-bold text-navy/60">Everyone competing today.</p>
              </div>
              <button
                onClick={() => setShowDirectory(false)}
                aria-label="Close"
                className="w-8 h-8 shrink-0 rounded-lg border-[3px] border-ink bg-white hover:bg-cream font-black text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ParticipantDirectoryList />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
