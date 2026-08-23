import { Link, Navigate } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { Badge } from '../../components/Badge';
import { EditableNameField } from '../../components/EditableNameField';
import { ProfileEditor } from '../../components/ProfileEditor';
import { TeamRosterGrid } from '../../components/TeamRosterGrid';
import { useMyTeam } from '../../hooks/useTeam';
import { useHackathonState } from '../../hooks/useHackathon';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../lib/apiClient';
import { comicButton } from '../../lib/comic';

/**
 * CEO dashboard. The CEO's own team slot is auto-assigned to their home
 * department the instant they're promoted (see the backend's
 * promoteTopScorers) — there's no separate department-selection step, so
 * this always has a roster to show.
 */
export function CeoDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: team, isLoading, error, refetch } = useMyTeam();
  const { data: hackathonState } = useHackathonState();

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !team) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  // Once finalized, this page has nothing left for the CEO to do (no
  // deliverables/pitch-deck management here — that's /team, same as every
  // other member) — send them straight there. Matters most on login: every
  // CEO lands on /ceo first (see roleRouting.ts), so without this a
  // finalized CEO logging back in had no way to reach their actual team hub
  // except remembering the /team URL by hand. Mirrors TeamHubPage's own
  // reverse redirect (finalized check there sends a NOT-yet-finalized CEO
  // back here instead).
  if (team.finalizedAt) {
    return <Navigate to="/team" replace />;
  }

  const me = team.members.find((m) => m.id === team.ceoId);

  return (
    <div className="flex flex-col gap-6">
      <section className="comic-panel p-6">
        <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-lg font-black uppercase tracking-wide text-navy">
            {team.name ?? 'Your team (not yet named)'}
          </h2>
          <Badge tone="gold">CEO</Badge>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
          <div>
            <dt className="text-forest text-xs uppercase font-black">CEO</dt>
            {user?.fullName ? <EditableNameField currentName={user.fullName} /> : <dd className="text-ink font-bold mt-0.5">{me?.fullName}</dd>}
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Hackathon phase</dt>
            <dd className="text-ink font-bold mt-0.5">{hackathonState?.phaseLabel ?? '…'}</dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Department</dt>
            <dd className="text-ink font-bold mt-0.5" data-testid="ceo-assigned-department">
              {me?.slotDepartment}
            </dd>
          </div>
          <div>
            <dt className="text-forest text-xs uppercase font-black">Finalized</dt>
            <dd className="mt-0.5">
              <Badge tone={team.finalizedAt ? 'success' : 'neutral'}>{team.finalizedAt ? 'Yes' : 'Not yet'}</Badge>
            </dd>
          </div>
        </dl>

        <TeamRosterGrid team={team} />

        {!team.isComplete && (
          <div className="mt-5 rounded-xl border-[3px] border-ink bg-crimson/10 px-4 py-3 flex flex-col items-start gap-3 shadow-[4px_4px_0px_#111111]">
            <p className="text-crimson font-black text-sm uppercase">NEXT STEP: Recruit the remaining departments using QR</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/ceo/recruit" className={comicButton('crimson')}>
                SCAN MEMBER
              </Link>
              {hackathonState?.allowIncompleteTeams && (
                <Link to="/ceo/team/finalize" className={comicButton('white', 'sm')} data-testid="finalize-incomplete-link">
                  Finalize anyway
                </Link>
              )}
            </div>
            {hackathonState?.allowIncompleteTeams && (
              <p className="text-xs font-bold text-navy/70">
                Admin has allowed incomplete rosters this round — you can finalize with fewer than 5 members if you need to.
              </p>
            )}
          </div>
        )}

        {team.isComplete && !team.finalizedAt && (
          <div className="mt-5 rounded-xl border-[3px] border-ink bg-forest/10 px-4 py-3 flex flex-col items-start gap-3 shadow-[4px_4px_0px_#111111]">
            <p className="text-forest font-black text-sm uppercase">TEAM COMPLETE — NEXT: FINALIZE TEAM</p>
            <Link to="/ceo/team/finalize" className={comicButton('crimson')}>
              FINALIZE TEAM
            </Link>
          </div>
        )}
      </section>

      {user && <ProfileEditor user={user} />}
    </div>
  );
}
