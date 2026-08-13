import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useHackathonState } from '../../hooks/useHackathon';
import { useMyCeoChallenge, useSubmitCeoAnswers } from '../../hooks/useCeoChallenge';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import type { MyCeoChallengeResult } from '../../types/api';

type Result = 'success' | 'ended' | null;

/**
 * Derives "which topic is active right now" and "when does it end" purely
 * from server timestamps (challengeStartedAt + challengeDurationSeconds-per-
 * topic + serverNow), the same clock-skew-corrected approach CountdownTimer
 * already uses. Every participant computes the same values from the same
 * inputs, so topics advance in lockstep for everyone with no server push —
 * "everyone's timer is in sync; once time stops on one topic, move to the
 * next immediately."
 */
function useSyncedTopic(data: MyCeoChallengeResult | undefined) {
  const [, forceTick] = useState(0);
  const offsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (data?.serverNow && offsetRef.current === null) {
      offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    }
  }, [data?.serverNow]);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 200);
    return () => clearInterval(interval);
  }, []);

  const totalTopics = data?.questions.length ?? 0;
  if (!data?.challengeStartedAt || totalTopics === 0) {
    return { topicIndex: 0, topicEndsAtMs: 0, roundOver: false };
  }

  const offset = offsetRef.current ?? 0;
  const nowCorrected = Date.now() + offset;
  const startedAtMs = new Date(data.challengeStartedAt).getTime();
  const perTopicMs = data.challengeDurationSeconds * 1000;
  const elapsedMs = Math.max(0, nowCorrected - startedAtMs);
  const rawIndex = Math.floor(elapsedMs / perTopicMs);
  const topicIndex = Math.min(rawIndex, totalTopics - 1);
  const topicEndsAtMs = startedAtMs + (topicIndex + 1) * perTopicMs;

  return { topicIndex, topicEndsAtMs, roundOver: rawIndex >= totalTopics };
}

/**
 * The CEO Selection Competition — identification format (req. 41-53).
 * Topics play in a synchronized sequence for every participant at once; each
 * topic gets a text box for one typed word, locked in the instant the shared
 * clock advances to the next topic. Submitting never reveals whether you
 * became CEO — that's ranked across everyone's attempt only once the round
 * ends (server-side, see hackathon.service.ts's promoteTopScorers).
 */
export function ParticipantChallengePage() {
  const user = useAuthStore((s) => s.user);
  const { data: state } = useHackathonState();
  const phase = state?.phase;

  const challengeQuery = useMyCeoChallenge(phase === 'CEO_CHALLENGE_ACTIVE');
  const submit = useSubmitCeoAnswers();
  const { topicIndex, topicEndsAtMs, roundOver } = useSyncedTopic(challengeQuery.data);

  const answersRef = useRef<Record<string, string>>({});
  const lastTopicIndexRef = useRef<number | null>(null);
  const hasFiredSubmitRef = useRef(false);
  const [inputValue, setInputValue] = useState('');

  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const questions = challengeQuery.data?.questions ?? [];
  const currentQuestion = questions[topicIndex];
  const alreadySubmitted = challengeQuery.data?.alreadySubmitted ?? false;

  // The synchronized clock, not a click, decides when a topic ends — capture
  // whatever was typed for the outgoing topic, then clear the box for the new one.
  useEffect(() => {
    if (lastTopicIndexRef.current === null) {
      lastTopicIndexRef.current = topicIndex;
      return;
    }
    if (lastTopicIndexRef.current !== topicIndex) {
      const prevQuestion = questions[lastTopicIndexRef.current];
      if (prevQuestion) answersRef.current[prevQuestion.id] = inputValue;
      lastTopicIndexRef.current = topicIndex;
      setInputValue('');
    }
    // Only topicIndex should retrigger this — it fires exactly once per transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex]);

  // Auto-fires the one batch submission the instant the shared clock says the
  // last topic's window has closed — there is no manual "submit" action.
  useEffect(() => {
    if (!roundOver || alreadySubmitted || hasFiredSubmitRef.current) return;
    hasFiredSubmitRef.current = true;
    if (currentQuestion) answersRef.current[currentQuestion.id] = inputValue;
    const payload = Object.entries(answersRef.current)
      .filter(([, answer]) => answer.trim().length > 0)
      .map(([questionId, answer]) => ({ questionId, answer }));
    submit.mutate(payload, { onSuccess: (data) => setSubmittedScore(data.score) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundOver, alreadySubmitted]);

  // Loading-then-reveal: once the round genuinely ends, hold on a brief
  // "calculating" beat before telling this participant the outcome — the
  // backend, not this page, already decided it (see RealtimeProvider).
  useEffect(() => {
    if (result || revealing || !phase) return;
    if (phase !== 'CEO_CHALLENGE_ACTIVE') {
      setRevealing(true);
      const timer = setTimeout(() => {
        setResult(user?.role === 'CEO' ? 'success' : 'ended');
        setRevealing(false);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [phase, result, revealing, user?.role]);

  if (!user || !state) return <LoadingState label="Loading challenge…" />;

  if (result === null && !revealing && phase !== 'CEO_CHALLENGE_ACTIVE' && state.participantsLocked) {
    return <Navigate to="/participant" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-10" data-testid="challenge-page">
      {revealing && (
        <div className="text-center flex flex-col items-center gap-4" data-testid="revealing">
          <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-accent-400 animate-spin" />
          <h2 className="text-xl font-black text-slate-100 tracking-tight">CALCULATING RESULTS…</h2>
        </div>
      )}

      {!revealing && result === 'success' && (
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

      {!revealing && result === 'ended' && (
        <div className="text-center flex flex-col items-center gap-3" data-testid="result-ended">
          <h2 className="text-2xl font-black text-slate-100">CHALLENGE ENDED</h2>
          <p className="text-slate-300">CEOs have been selected for this round.</p>
          {submittedScore !== null && <p className="text-slate-500 text-sm">Your score: {submittedScore}</p>}
          <p className="text-slate-500 text-sm">Please wait for team formation.</p>
        </div>
      )}

      {!revealing && result === null && phase === 'CEO_CHALLENGE_ACTIVE' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6" data-testid="challenge-active">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">CEO SELECTION CHALLENGE</h2>

          {challengeQuery.isLoading && <LoadingState label="Loading topics…" />}
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

          {!alreadySubmitted && submittedScore === null && currentQuestion && topicEndsAtMs > 0 && (
            <div className="w-full flex flex-col items-center gap-5" data-testid="quiz">
              <p
                className="text-sm font-bold uppercase tracking-wide text-accent-400 text-center"
                data-testid="topic-progress"
              >
                Topic {topicIndex + 1} of {questions.length}
              </p>

              <CountdownTimer
                endsAt={new Date(topicEndsAtMs).toISOString()}
                serverNow={challengeQuery.data!.serverNow}
              />

              <p className="text-lg font-semibold text-slate-100 text-center" data-testid="topic-prompt">
                {currentQuestion.question}
              </p>

              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your answer…"
                maxLength={100}
                data-testid="topic-answer-input"
                className="w-full text-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-lg font-medium text-slate-100 focus:border-primary-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 -mt-2">Your answer locks in automatically when time runs out.</p>

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
