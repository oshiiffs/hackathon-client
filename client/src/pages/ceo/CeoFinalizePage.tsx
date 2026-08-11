import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useFinalizationStatus, useFinalizeTeam } from '../../hooks/useFinalization';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
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
      <h2 className="text-2xl font-black text-primary-400">TEAM FINALIZED</h2>
      <p className="text-xl font-bold text-slate-100">{team.name}</p>
      <p className="text-accent-400 font-bold">{team.category}</p>
      <p className="text-slate-400 text-sm" data-testid="finalize-member-count">
        {team.members.length} / 5 MEMBERS
      </p>
      <div className="grid grid-cols-5 gap-2 text-xs text-slate-300 mt-1">
        {ALL_DEPARTMENTS.map((dept) => (
          <div key={dept}>
            ✓ {dept}
          </div>
        ))}
      </div>
      <Link
        to="/team"
        className="mt-3 rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-black px-5 py-2.5 text-sm transition"
      >
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
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">TEAM READY</h2>
        <p className="text-accent-400 font-bold mt-1" data-testid="finalize-member-count">
          {status.memberCount} / 5 MEMBERS
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2 text-sm">
        {ALL_DEPARTMENTS.map((dept) => (
          <div key={dept} className={status.departmentComplete[dept] ? 'text-primary-400 font-bold' : 'text-slate-600'}>
            {status.departmentComplete[dept] ? '✓' : '—'} {dept}
          </div>
        ))}
      </div>

      {!status.canFinalize && status.reason && (
        <p className="text-sm text-slate-400 max-w-sm" data-testid="finalize-not-ready">
          {status.reason === 'TEAM_NOT_COMPLETE'
            ? 'Recruit the remaining departments before finalizing.'
            : `Finalization isn't available right now (${status.reason}).`}
        </p>
      )}

      <div className="w-full max-w-sm text-left">
        <label htmlFor="team-name" className="text-xs font-bold uppercase text-slate-400">
          Team Name
        </label>
        <input
          id="team-name"
          data-testid="team-name-input"
          value={name}
          maxLength={80}
          disabled={!status.canFinalize}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 disabled:opacity-50"
        />
      </div>

      <div className="w-full max-w-sm text-left">
        <p className="text-xs font-bold uppercase text-slate-400 mb-2">Select HEAT Category</p>
        <div className="grid grid-cols-2 gap-3">
          {status.categories.map((c) => (
            <button
              key={c.category}
              data-testid={`category-button-${c.category}`}
              disabled={c.full || !status.canFinalize}
              onClick={() => setCategory(c.category)}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                category === c.category ? 'border-accent-500 bg-accent-950/40 text-accent-300' : 'border-slate-700 bg-slate-900 text-slate-100'
              }`}
            >
              <p>{CATEGORY_LABELS[c.category]}</p>
              <p className="text-xs mt-1 font-normal text-slate-400">
                {c.used} / {c.capacity}
                {c.full ? ' FULL' : ''}
              </p>
            </button>
          ))}
        </div>
      </div>

      <button
        data-testid="finalize-team-button"
        disabled={!canSubmit}
        onClick={openConfirm}
        className="rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-40 text-slate-950 font-black px-6 py-3 text-sm transition"
      >
        FINALIZE TEAM
      </button>

      {finalizeTeam.isError && (
        <p className="text-red-400 text-sm" data-testid="finalize-error">
          {getApiErrorCode(finalizeTeam.error)}: {getApiErrorMessage(finalizeTeam.error)}
        </p>
      )}

      {confirming && category && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-10" data-testid="finalize-confirm-dialog">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm flex flex-col items-center gap-3 text-center">
            <p className="text-slate-100 font-bold">FINALIZE TEAM?</p>
            <div className="text-sm">
              <p className="text-slate-500 text-xs uppercase font-semibold">Team</p>
              <p className="text-slate-100 font-bold">{trimmedName}</p>
            </div>
            <div className="text-sm">
              <p className="text-slate-500 text-xs uppercase font-semibold">Category</p>
              <p className="text-slate-100 font-bold">{CATEGORY_LABELS[category]}</p>
            </div>
            <div className="text-sm">
              <p className="text-slate-500 text-xs uppercase font-semibold">Members</p>
              <p className="text-slate-100 font-bold">{status.memberCount} / 5</p>
            </div>
            <p className="text-slate-400 text-xs">Once finalized, normal recruitment will be closed.</p>
            <div className="flex gap-3 mt-1">
              <button
                data-testid="cancel-finalize-button"
                onClick={cancelConfirm}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold px-4 py-2 transition"
              >
                CANCEL
              </button>
              <button
                data-testid="confirm-finalize-button"
                disabled={finalizeTeam.isPending}
                onClick={confirmFinalize}
                className="rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2 text-sm transition"
              >
                FINALIZE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
