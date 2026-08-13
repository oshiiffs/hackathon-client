import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useHackathonState } from '../../hooks/useHackathon';
import { useMyCeoChallenge, useSubmitCeoAnswers } from '../../hooks/useCeoChallenge';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';

type Result = 'success' | 'ended' | null;

/**
 * The CEO Selection Competition — a scored, timed multiple-choice quiz
 * (req. 41-53). Unlike the old tap-race, submitting here never tells you
 * whether you became CEO: every participant's score is ranked only once the
 * round ends (server-side, see hackathon.service.ts's promoteTopScorers),
 * and this page only ever reacts to that — via `phase` leaving
 * CEO_CHALLENGE_ACTIVE and (for an actual winner) RealtimeProvider's
 * challenge:end handler refreshing `user.role` to CEO in the background.
 */
export function ParticipantChallengePage() {
  const user = useAuthStore((s) => s.user);
  const { data: state } = useHackathonState();
  const phase = state?.phase;

  const challengeQuery = useMyCeoChallenge(phase === 'CEO_CHALLENGE_ACTIVE');
  const submit = useSubmitCeoAnswers();

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result>(null);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  // Passive observation: once the round genuinely ends, show the right
  // outcome no matter how/whether this participant submitted — the backend
  // decides who won, this page never computes it locally.
  useEffect(() => {
    if (result || !phase) return;
    if (phase !== 'CEO_CHALLENGE_ACTIVE') {
      setResult(user?.role === 'CEO' ? 'success' : 'ended');
    }
  }, [phase, result, user?.role]);

  const questions = challengeQuery.data?.questions ?? [];
  const currentQuestion = questions[index];
  const alreadySubmitted = challengeQuery.data?.alreadySubmitted ?? false;

  function handleSubmit() {
    if (submit.isPending || submit.isSuccess) return;
    const payload = Object.entries(answers).map(([questionId, selectedOption]) => ({ questionId, selectedOption }));
    submit.mutate(payload, { onSuccess: (data) => setSubmittedScore(data.score) });
  }

  if (!user || !state) return <LoadingState label="Loading challenge…" />;

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

      {result === 'ended' && (
        <div className="text-center flex flex-col items-center gap-3" data-testid="result-ended">
          <h2 className="text-2xl font-black text-slate-100">CHALLENGE ENDED</h2>
          <p className="text-slate-300">CEOs have been selected for this round.</p>
          {submittedScore !== null && <p className="text-slate-500 text-sm">Your score: {submittedScore}</p>}
          <p className="text-slate-500 text-sm">Please wait for team formation.</p>
        </div>
      )}

      {result === null && phase === 'CEO_CHALLENGE_ACTIVE' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6" data-testid="challenge-active">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">CEO SELECTION CHALLENGE</h2>

          {challengeQuery.data?.challengeEndsAt && (
            <CountdownTimer
              endsAt={challengeQuery.data.challengeEndsAt}
              serverNow={challengeQuery.data.serverNow}
              onExpire={handleSubmit}
            />
          )}

          {challengeQuery.isLoading && <LoadingState label="Loading questions…" />}
          {challengeQuery.isError && (
            <ErrorState message={getApiErrorMessage(challengeQuery.error)} onRetry={() => challengeQuery.refetch()} />
          )}

          {(alreadySubmitted || submittedScore !== null) && (
            <div className="text-center" data-testid="submitted">
              <p className="text-slate-300 font-bold">Answers submitted.</p>
              <p className="text-slate-500 text-sm mt-1">Your score: {submittedScore ?? challengeQuery.data?.myScore}</p>
              <p className="text-slate-500 text-sm mt-3">Waiting for the round to end…</p>
            </div>
          )}

          {!alreadySubmitted && submittedScore === null && currentQuestion && (
            <div className="w-full flex flex-col gap-4" data-testid="quiz">
              <p
                className="text-sm font-bold uppercase tracking-wide text-accent-400 text-center"
                data-testid="question-progress"
              >
                Question {index + 1} of {questions.length}
              </p>
              <p className="text-lg font-semibold text-slate-100 text-center">{currentQuestion.question}</p>
              <div className="flex flex-col gap-2">
                {currentQuestion.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [currentQuestion.id]: optionIndex }))}
                    className={`text-left rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      answers[currentQuestion.id] === optionIndex
                        ? 'border-primary-500 bg-primary-950/40 text-primary-300'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="flex justify-between gap-3 mt-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold px-4 py-2 text-sm transition"
                >
                  Back
                </button>
                {index < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 text-sm transition"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submit.isPending}
                    onClick={handleSubmit}
                    data-testid="submit-answers-button"
                    className="rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-slate-950 font-black px-6 py-2 text-sm transition"
                  >
                    {submit.isPending ? 'Submitting…' : 'SUBMIT ANSWERS'}
                  </button>
                )}
              </div>

              {submit.isError && getApiErrorCode(submit.error) !== 'CEO_ANSWERS_ALREADY_SUBMITTED' && (
                <p className="text-red-400 text-sm text-center">{getApiErrorMessage(submit.error)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
