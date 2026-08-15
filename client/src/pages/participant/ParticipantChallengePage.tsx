import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useHackathonState } from '../../hooks/useHackathon';
import { useMyCeoChallenge, useSubmitCeoAnswer } from '../../hooks/useCeoChallenge';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../lib/apiClient';
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
 * topic gets a text box for one typed word, SAVED TO THE SERVER THE INSTANT
 * the shared clock advances past it — not batched to the end of the round.
 * That matters: the admin's "stop challenge" ranks whoever is already saved
 * in Postgres at that exact moment, with no wait for stragglers, so a
 * participant's progress has to already be durable well before the round
 * can end (see participant.service.ts#submitCeoAnswer's doc comment for the
 * bug this fixes — a sole participant testing solo who got skipped because
 * their answers were still sitting in local state when the round was
 * stopped). Submitting never reveals whether you became CEO — that's ranked
 * across everyone's saved answers only once the round ends (server-side, see
 * hackathon.service.ts's promoteTopScorers).
 */
export function ParticipantChallengePage() {
  const user = useAuthStore((s) => s.user);
  const { data: state } = useHackathonState();
  const phase = state?.phase;

  const challengeQuery = useMyCeoChallenge(phase === 'CEO_CHALLENGE_ACTIVE');
  const submitAnswer = useSubmitCeoAnswer();
  const { topicIndex, topicEndsAtMs, roundOver } = useSyncedTopic(challengeQuery.data);

  const lastTopicIndexRef = useRef<number | null>(null);
  const hasFlushedFinalRef = useRef(false);
  const revealTimerStartedRef = useRef(false);
  const [inputValue, setInputValue] = useState('');
  const [score, setScore] = useState(0);

  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const questions = challengeQuery.data?.questions ?? [];
  const currentQuestion = questions[topicIndex];
  const roundActive = phase === 'CEO_CHALLENGE_ACTIVE' && !roundOver;

  // Seed the running score once the initial fetch lands (covers a reload
  // mid-round: earlier topics are already saved server-side regardless).
  useEffect(() => {
    if (challengeQuery.data) setScore(challengeQuery.data.myScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeQuery.data?.round]);

  function saveAnswer(questionId: string, answer: string) {
    if (answer.trim().length === 0) return;
    submitAnswer.mutate({ questionId, answer }, { onSuccess: (data) => setScore(data.score) });
  }

  // The synchronized clock, not a click, decides when a topic ends — save
  // whatever was typed for the outgoing topic immediately, then clear the
  // box for the new one.
  useEffect(() => {
    if (lastTopicIndexRef.current === null) {
      lastTopicIndexRef.current = topicIndex;
      return;
    }
    if (lastTopicIndexRef.current !== topicIndex) {
      const prevQuestion = questions[lastTopicIndexRef.current];
      if (prevQuestion) saveAnswer(prevQuestion.id, inputValue);
      lastTopicIndexRef.current = topicIndex;
      setInputValue('');
    }
    // Only topicIndex should retrigger this — it fires exactly once per transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex]);

  // Final flush: whatever's typed for the CURRENT (still in-progress) topic
  // when the round ends — naturally, or via an early admin stop — gets saved
  // once. Every earlier topic was already saved as it happened above, so
  // this only ever covers the one topic that hadn't finished yet.
  useEffect(() => {
    const roundEnding = roundOver || (phase !== undefined && phase !== 'CEO_CHALLENGE_ACTIVE');
    if (!roundEnding || hasFlushedFinalRef.current) return;
    hasFlushedFinalRef.current = true;
    if (currentQuestion) saveAnswer(currentQuestion.id, inputValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundOver, phase]);

  // Loading-then-reveal: once the round genuinely ends, hold on a brief
  // "calculating" beat before telling this participant the outcome — the
  // backend, not this page, already decided it (see RealtimeProvider).
  //
  // `revealing` is deliberately NOT a dependency here: this effect re-renders
  // constantly (useSyncedTopic ticks every 200ms for the whole component's
  // life), so putting the state it itself sets into the dependency array
  // caused React to run this effect's cleanup — clearTimeout(timer) — the
  // instant setRevealing(true) triggered a re-render, cancelling the reveal
  // before it could ever fire. A ref-guarded start with no such dependency
  // avoids that self-cancellation.
  useEffect(() => {
    if (result || revealTimerStartedRef.current || !phase) return;
    if (phase !== 'CEO_CHALLENGE_ACTIVE') {
      revealTimerStartedRef.current = true;
      setRevealing(true);
      const timer = setTimeout(() => {
        setResult(user?.role === 'CEO' ? 'success' : 'ended');
        setRevealing(false);
      }, 2200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, user?.role]);

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
          <p className="text-slate-500 text-sm">Your score: {score}</p>
          <p className="text-slate-500 text-sm">Please wait for team formation.</p>
          <Link
            to="/participant"
            className="mt-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 text-sm transition"
          >
            Go to dashboard
          </Link>
        </div>
      )}

      {!revealing && result === null && phase === 'CEO_CHALLENGE_ACTIVE' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6" data-testid="challenge-active">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">CEO SELECTION CHALLENGE</h2>

          {challengeQuery.isLoading && <LoadingState label="Loading topics…" />}
          {challengeQuery.isError && (
            <ErrorState message={getApiErrorMessage(challengeQuery.error)} onRetry={() => challengeQuery.refetch()} />
          )}

          {!roundActive && challengeQuery.data && (
            <div className="text-center" data-testid="locking-in">
              <p className="text-slate-300 font-bold">Locking in your last answer…</p>
              <p className="text-slate-500 text-sm mt-1">Your score: {score}</p>
            </div>
          )}

          {roundActive && currentQuestion && topicEndsAtMs > 0 && (
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

              {submitAnswer.isError && <p className="text-red-400 text-sm text-center">{getApiErrorMessage(submitAnswer.error)}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
