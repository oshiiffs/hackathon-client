import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useFinalizationStatus, useFinalizeTeam } from '../../hooks/useFinalization';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import { comicButton } from '../../lib/comic';
import { ALL_DEPARTMENTS, type HeatCategory, type Team } from '../../types/api';

const CATEGORY_LABELS: Record<HeatCategory, string> = {
  HEALTH: 'HEALTH',
  ENVIRONMENT: 'ENVIRONMENT',
  AGRICULTURE: 'AGRICULTURE',
  TOURISM: 'TOURISM',
};

function FinalizedView({ team }: { team: Team }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" data-testid="finalize-success">
      <p className="text-5xl">🎉</p>
      <h2 className="text-2xl font-black text-forest uppercase">TEAM FINALIZED</h2>
      <p className="text-xl font-black text-ink">{team.name}</p>
      <p className="text-crimson font-black uppercase">{team.category}</p>
      <p className="text-navy text-sm font-bold" data-testid="finalize-member-count">
        {team.members.length} / 5 MEMBERS
      </p>
      <div className="grid grid-cols-5 gap-2 text-xs text-ink mt-1">
        {ALL_DEPARTMENTS.map((dept) => {
          const filled = team.members.some((m) => m.slotDepartment === dept);
          return (
            <div key={dept} className={filled ? 'text-forest font-black' : 'text-navy/30 font-bold'}>
              {filled ? '✓' : '—'} {dept}
            </div>
          );
        })}
      </div>
      <Link to="/team" className={`mt-3 ${comicButton('crimson')}`}>
        OPEN TEAM HUB
      </Link>
    </div>
  );
}

/**
 * Backend is authoritative for every rule here (composition, name
 * uniqueness, category capacity) — this page's own checks (disabling a full
 * category, requiring a name before enabling the button) are UX only. The
 * atomic finalize transaction re-verifies everything from scratch and can
 * still reject a state this page just showed as "ready."
 */
export function CeoFinalizePage() {
  const { data: status, isLoading, error, refetch } = useFinalizationStatus();
  const finalizeTeam = useFinalizeTeam();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HeatCategory | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !status) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  if (status.team.finalizedAt) {
    return <FinalizedView team={status.team} />;
  }

  if (finalizeTeam.isSuccess) {
    return <FinalizedView team={finalizeTeam.data} />;
  }

  const trimmedName = name.trim();
  const canSubmit = status.canFinalize && trimmedName.length > 0 && category !== null;

  function openConfirm() {
    if (!canSubmit) return;
    setConfirming(true);
  }

  function cancelConfirm() {
    setConfirming(false);
  }

  function confirmFinalize() {
    if (!category) return;
    setConfirming(false);
    finalizeTeam.mutate({ name: trimmedName, category });
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center" data-testid="ceo-finalize-page">
      <div>
        <h2 className="text-2xl font-black text-ink tracking-tight uppercase">TEAM READY</h2>
        <p className="text-crimson font-black mt-1 uppercase" data-testid="finalize-member-count">
          {status.memberCount} / 5 MEMBERS
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 text-sm">
        {ALL_DEPARTMENTS.map((dept) => (
          <div key={dept} className={status.departmentComplete[dept] ? 'text-forest font-black' : 'text-navy/30 font-bold'}>
            {status.departmentComplete[dept] ? '✓' : '—'} {dept}
          </div>
        ))}
      </div>

      {status.allowIncompleteTeams && !status.team.finalizedAt && (
        <p className="text-xs font-bold text-forest max-w-sm">
          Recruitment is short on participants today — teams may finalize with fewer than 5 members.
        </p>
      )}

      {!status.canFinalize && status.reason && (
        <p className="text-sm font-bold text-navy max-w-sm" data-testid="finalize-not-ready">
          {status.reason === 'TEAM_NOT_COMPLETE'
            ? status.allowIncompleteTeams
              ? 'Recruit at least one member before finalizing.'
              : 'Recruit the remaining departments before finalizing.'
            : `Finalization isn't available right now (${status.reason}).`}
        </p>
      )}

      <div className="w-full max-w-sm text-left">
        <label htmlFor="team-name" className="text-xs font-black uppercase text-forest">
          Team Name
        </label>
        <input
          id="team-name"
          data-testid="team-name-input"
          value={name}
          maxLength={80}
          disabled={!status.canFinalize}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-ink font-bold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-crimson"
        />
        <p className="mt-1.5 text-[11px] font-bold text-crimson flex items-center gap-1" data-testid="team-name-caution">
          <span aria-hidden="true">⚠</span> Choose carefully — your team name is permanent and can&apos;t be changed once finalized.
        </p>
      </div>

      <div className="w-full max-w-sm text-left">
        <p className="text-xs font-black uppercase text-forest mb-2">Select HEAT Category</p>
        <div className="grid grid-cols-2 gap-3">
          {status.categories.map((c) => (
            <button
              key={c.category}
              data-testid={`category-button-${c.category}`}
              disabled={c.full || !status.canFinalize}
              onClick={() => setCategory(c.category)}
              className={`rounded-xl border-[3px] border-ink px-4 py-3 text-sm font-black uppercase transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 ${
                category === c.category ? 'bg-crimson text-ink shadow-[3px_3px_0px_#111111]' : 'bg-white text-ink shadow-[2px_2px_0px_#111111]'
              }`}
            >
              <p>{CATEGORY_LABELS[c.category]}</p>
              <p className="text-xs mt-1 font-bold normal-case opacity-70">
                {c.used} / {c.capacity}
                {c.full ? ' FULL' : ''}
              </p>
            </button>
          ))}
        </div>
      </div>

      <button data-testid="finalize-team-button" disabled={!canSubmit} onClick={openConfirm} className={comicButton('crimson')}>
        FINALIZE TEAM
      </button>

      {finalizeTeam.isError && (
        <p className="text-crimson font-bold text-sm" data-testid="finalize-error">
          {getApiErrorCode(finalizeTeam.error)}: {getApiErrorMessage(finalizeTeam.error)}
        </p>
      )}

      {confirming && category && (
        <div className="fixed inset-0 bg-ink/70 flex items-center justify-center p-4 z-10" data-testid="finalize-confirm-dialog">
          <div className="bg-white border-[3px] border-ink rounded-xl p-6 max-w-sm flex flex-col items-center gap-3 text-center shadow-[8px_8px_0px_#111111]">
            <p className="text-ink font-black uppercase">FINALIZE TEAM?</p>
            <div className="text-sm">
              <p className="text-forest text-xs uppercase font-black">Team</p>
              <p className="text-ink font-black">{trimmedName}</p>
            </div>
            <div className="text-sm">
              <p className="text-forest text-xs uppercase font-black">Category</p>
              <p className="text-ink font-black">{CATEGORY_LABELS[category]}</p>
            </div>
            <div className="text-sm">
              <p className="text-forest text-xs uppercase font-black">Members</p>
              <p className="text-ink font-black">{status.memberCount} / 5</p>
            </div>
            <p className="text-navy/60 text-xs">Once finalized, normal recruitment will be closed.</p>
            <p className="text-crimson text-xs font-bold">⚠ Your team name can&apos;t be changed after this.</p>
            <div className="flex gap-3 mt-1">
              <button data-testid="cancel-finalize-button" onClick={cancelConfirm} className={comicButton('white', 'sm')}>
                CANCEL
              </button>
              <button data-testid="confirm-finalize-button" disabled={finalizeTeam.isPending} onClick={confirmFinalize} className={comicButton('crimson', 'sm')}>
                FINALIZE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
