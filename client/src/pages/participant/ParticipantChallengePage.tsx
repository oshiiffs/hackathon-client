import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LoadingState } from '../../components/StateViews';
import { useHackathonState } from '../../hooks/useHackathon';
import { useSelectCeo } from '../../hooks/useCeoSelection';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';

type Result = 'success' | 'ceo_selected' | 'expired' | null;

const KNOWN_RESULT_CODES = new Set(['CHALLENGE_EXPIRED', 'CEO_ALREADY_SELECTED', 'ALREADY_CEO']);

/**
 * The backend — never this component — decides whether the challenge is
 * still active. This page only ever reacts to what /api/hackathon/state (via
 * sockets + polling) and the /api/participant/ceo/select response actually
 * say; it never computes "is it still open" from a locally-held countdown.
 */
export function ParticipantChallengePage() {
  const user = useAuthStore((s) => s.user);
  const { data: state } = useHackathonState();
  const select = useSelectCeo();
  const [result, setResult] = useState<Result>(null);

  const phase = state?.phase;

  // Passive observation: if the phase moves away from CEO_CHALLENGE_ACTIVE
  // without THIS user having clicked anything (someone else won, or nobody
  // did before the deadline), show the right result instead of a dead screen.
  useEffect(() => {
    if (result || !phase) return;
    if (phase !== 'CEO_CHALLENGE_ACTIVE') {
      setResult(user?.role === 'CEO' ? 'success' : 'ceo_selected');
    }
  }, [phase, result, user?.role]);

  function handleBecomeCeo() {
    select.mutate(undefined, {
      onSuccess: () => setResult('success'),
      onError: (err) => {
        const code = getApiErrorCode(err);
        if (code === 'CHALLENGE_EXPIRED') setResult('expired');
        else if (code === 'CEO_ALREADY_SELECTED') setResult('ceo_selected');
        else if (code === 'ALREADY_CEO') setResult('success');
        // ALREADY_DRAFTED / NOT_ELIGIBLE etc. fall through to the inline error below.
      },
    });
  }

  if (!user || !state) return <LoadingState label="Loading challenge…" />;

  // Nothing to do here — never became active, and we have no result to show.
  if (result === null && phase !== 'CEO_CHALLENGE_ACTIVE' && state.participantsLocked) {
    return <Navigate to="/participant" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-10" data-testid="challenge-page">
      {result === 'success' && (
        <div className="text-center flex flex-col items-center gap-3" data-testid="result-success">
          <p className="text-5xl">🎉</p>
          <h2 className="text-2xl font-black text-primary-400">YOU ARE THE CEO</h2>
          <p className="text-slate-300">Your CEO role has been confirmed.</p>
          <p className="text-slate-500 text-sm">Continue to team formation.</p>
          <Link
            to="/ceo"
            className="mt-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 text-sm transition"
          >
            Go to CEO dashboard
          </Link>
        </div>
      )}

      {result === 'ceo_selected' && (
        <div className="text-center flex flex-col items-center gap-3" data-testid="result-ceo-selected">
          <h2 className="text-2xl font-black text-slate-100">CEO SELECTED</h2>
          <p className="text-slate-300">The CEO challenge has ended.</p>
          <p className="text-slate-500 text-sm">Please wait for team formation.</p>
        </div>
      )}

      {result === 'expired' && (
        <div className="text-center flex flex-col items-center gap-3" data-testid="result-expired">
          <h2 className="text-2xl font-black text-slate-100">CHALLENGE ENDED</h2>
          <p className="text-slate-500 text-sm">No further CEO selections are accepted.</p>
        </div>
      )}

      {result === null && phase === 'CEO_CHALLENGE_ACTIVE' && state.challengeEndsAt && (
        <div className="text-center flex flex-col items-center gap-6" data-testid="challenge-active">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">CEO CHALLENGE</h2>
          <CountdownTimer endsAt={state.challengeEndsAt} serverNow={state.serverNow} />
          <p className="text-slate-400">Think fast.</p>
          <button
            onClick={handleBecomeCeo}
            disabled={select.isPending}
            data-testid="become-ceo-button"
            className="px-10 py-6 rounded-full bg-accent-500 hover:bg-accent-400 active:scale-95 disabled:opacity-50 text-slate-950 text-2xl font-black shadow-2xl transition"
          >
            {select.isPending ? 'Submitting…' : 'BECOME CEO'}
          </button>
          {select.isError && !KNOWN_RESULT_CODES.has(getApiErrorCode(select.error) ?? '') && (
            <p className="text-red-400 text-sm">{getApiErrorMessage(select.error)}</p>
          )}
        </div>
      )}
    </div>
  );
}
