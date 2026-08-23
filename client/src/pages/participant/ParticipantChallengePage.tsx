import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useSyncedTopic } from '../../hooks/useSyncedTopic';
import { useHackathonState } from '../../hooks/useHackathon';
import { useCeoOverallLeaderboard, useCeoTopicReveal, useMyCeoChallenge, useSubmitCeoAnswer } from '../../hooks/useCeoChallenge';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../lib/apiClient';
import { comicButton } from '../../lib/comic';

type Result = 'success' | 'ended' | null;

/** Joins names into a natural-reading list: "Alice", "Alice and Bob", or
 * "Alice, Bob and Carol" — used for the topic reveal's correct-answerers
 * callout below. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Shown for the 5s reveal window after a topic's answering countdown runs
 * out — fetches that one topic's correct answer, which the server only
 * hands over once it has independently verified the window has closed (see
 * useCeoTopicReveal / the backend's getCeoTopicReveal). Also names everyone
 * who answered THIS topic fully correctly (partial-credit answers earn
 * points toward the overall round score — see OverallLeaderboard below —
 * but aren't called out here, which is specifically "who nailed it"). */
function TopicReveal({
  questionId,
  questionText,
  topicLabel,
  revealEndsAtMs,
  serverNow,
}: {
  questionId: string;
  questionText: string;
  topicLabel: string;
  revealEndsAtMs: number;
  serverNow: string;
}) {
  const reveal = useCeoTopicReveal(questionId, true);
  const leaderboard = reveal.data?.leaderboard ?? [];
  return (
    <div className="w-full flex flex-col items-center gap-5" data-testid="topic-reveal">
      <p className="text-sm font-black uppercase tracking-wide text-crimson text-center">{topicLabel}</p>
      <p className="text-sm font-black uppercase tracking-wide text-navy/50 text-center">Time&apos;s up!</p>

      <CountdownTimer endsAt={new Date(revealEndsAtMs).toISOString()} serverNow={serverNow} />

      <p className="text-lg font-bold text-ink text-center">{questionText}</p>

      <div className="w-full rounded-xl border-[3px] border-ink bg-lime/40 px-6 py-4 text-center shadow-[4px_4px_0px_#111111]">
        <p className="text-xs font-black uppercase tracking-wide text-forest mb-1">Correct answer</p>
        <p className="text-2xl font-black text-ink" data-testid="topic-correct-answer">
          {reveal.isLoading ? '…' : reveal.isError ? 'Unavailable' : (reveal.data?.correctAnswer || '—')}
        </p>
        {reveal.isError && (
          <button
            type="button"
            onClick={() => reveal.refetch()}
            className="mt-1 text-[11px] font-bold uppercase text-forest hover:text-crimson underline"
          >
            Retry
          </button>
        )}
      </div>

      {!reveal.isLoading && !reveal.isError && (
        <div className="w-full rounded-xl border-[3px] border-ink bg-white px-5 py-4 shadow-[4px_4px_0px_#111111]" data-testid="topic-leaderboard">
          {leaderboard.length === 0 ? (
            <p className="text-sm font-bold text-navy/50 text-center">Nobody answered this topic correctly yet.</p>
          ) : (
            <p className="text-sm font-bold text-ink text-center">
              The people who answered the topic correctly are{' '}
              <span className="text-forest">{joinNames(leaderboard.map((p) => p.fullName))}</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The running top-5 scorers for the whole round so far — stays mounted (and
 * polling) for as long as `enabled` (== the round being active) is true,
 * covering every topic's answering AND reveal phases, not just one topic's
 * 5s reveal window like TopicReveal's own leaderboard. Unmounts once the
 * round ends, which is what stops it polling. */
function OverallLeaderboard({ enabled }: { enabled: boolean }) {
  const leaderboardQuery = useCeoOverallLeaderboard(enabled);
  const entries = leaderboardQuery.data ?? [];
  return (
    <div className="w-full rounded-xl border-[3px] border-ink bg-white px-5 py-4 shadow-[4px_4px_0px_#111111]" data-testid="overall-leaderboard">
      <p className="text-xs font-black uppercase tracking-wide text-navy/60 mb-2 text-center">Top 5 Scorers</p>
      {entries.length === 0 ? (
        <p className="text-sm font-bold text-navy/50 text-center">No scores yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {entries.map((p, i) => (
            <li key={p.userId} className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className="w-5 shrink-0 text-xs font-black text-navy/50">{i + 1}.</span>
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="w-6 h-6 shrink-0 rounded-full object-cover border-2 border-ink" />
              ) : (
                <span className="w-6 h-6 shrink-0 rounded-full bg-gold border-2 border-ink flex items-center justify-center text-[10px] font-black text-ink">
                  {p.fullName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate flex-1">{p.fullName}</span>
              <span className="text-xs font-black text-forest shrink-0" data-testid="overall-leaderboard-score">
                {p.score} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
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
 *
 * Each topic's countdown is followed by a 5s "reveal" window (see
 * useSyncedTopic's `topicPhase`) showing that topic's correct answer before
 * the clock advances to the next one.
 */
export function ParticipantChallengePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { data: state } = useHackathonState();
  const phase = state?.phase;

  const challengeQuery = useMyCeoChallenge(phase === 'CEO_CHALLENGE_ACTIVE');
  const submitAnswer = useSubmitCeoAnswer();
  const totalTopics = challengeQuery.data?.questions.length ?? 0;
  const { topicIndex, topicPhase, answerEndsAtMs, revealEndsAtMs, roundOver, serverNowIso } = useSyncedTopic(
    challengeQuery.data?.challengeStartedAt,
    challengeQuery.data?.challengeDurationSeconds ?? 30,
    challengeQuery.data?.serverNow,
    totalTopics,
  );

  const lastCycleKeyRef = useRef<string | null>(null);
  const hasFlushedFinalRef = useRef(false);
  const revealTimerStartedRef = useRef(false);
  const ceoRedirectStartedRef = useRef(false);
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

  // The synchronized clock, not a click, decides when a topic's answering
  // window ends — save whatever was typed the INSTANT that happens (the
  // `answering` -> `reveal` transition), not when the next topic starts.
  // That distinction matters here specifically: the reveal window shows the
  // correct answer, so saving on topicIndex change (which now only happens
  // after the reveal) would let someone read the answer and type it in
  // before it's recorded. The input box resets once a NEW topic's answering
  // phase begins.
  useEffect(() => {
    const key = `${topicIndex}:${topicPhase}`;
    if (lastCycleKeyRef.current === null) {
      lastCycleKeyRef.current = key;
      return;
    }
    if (lastCycleKeyRef.current === key) return;

    const [prevIndexStr, prevPhase] = lastCycleKeyRef.current.split(':');
    const prevIndex = Number(prevIndexStr);
    if (prevPhase === 'answering') {
      const prevQuestion = questions[prevIndex];
      if (prevQuestion) saveAnswer(prevQuestion.id, inputValue);
    }
    if (topicPhase === 'answering' && topicIndex !== prevIndex) {
      setInputValue('');
    }
    lastCycleKeyRef.current = key;
    // Only topicIndex/topicPhase should retrigger this — it fires exactly once per transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex, topicPhase]);

  // Final flush: whatever's typed for the CURRENT (still in-progress) topic
  // when the round ends early (an admin manual stop, before this topic's own
  // answering->reveal transition would have saved it) gets saved once. Every
  // topic that already went through its own transition above is unaffected —
  // this is just the safety net for an early cutoff.
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

  // Congratulations -> CEO Startup Name Selection is fully automatic: no
  // button, just a ~5s beat on the congratulations message before handing
  // off to CeoFinalizePage (which itself takes over the buttonless
  // name-timer -> video -> category-timer -> auto-finalize flow from there —
  // see that page's own doc comment). Ref-guarded the same way the reveal
  // timer above is, so this can only ever fire once.
  useEffect(() => {
    if (result !== 'success' || ceoRedirectStartedRef.current) return;
    ceoRedirectStartedRef.current = true;
    const timer = setTimeout(() => {
      navigate('/ceo/team/finalize', { replace: true });
    }, 5000);
    return () => clearTimeout(timer);
  }, [result, navigate]);

  if (!user || !state) return <LoadingState label="Loading challenge…" />;

  if (result === null && !revealing && phase !== 'CEO_CHALLENGE_ACTIVE' && state.participantsLocked) {
    return <Navigate to="/participant" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-10" data-testid="challenge-page">
      {revealing && (
        <div className="text-center flex flex-col items-center gap-4" data-testid="revealing">
          <div className="w-10 h-10 rounded-full border-4 border-ink border-t-crimson animate-spin" />
          <h2 className="text-xl font-black text-ink tracking-tight uppercase">CALCULATING RESULTS…</h2>
        </div>
      )}

      {!revealing && result === 'success' && (
        <div className="comic-panel text-center flex flex-col items-center gap-3 px-8 py-8" data-testid="result-success">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
          <p className="text-5xl">🎉</p>
          <h2 className="text-2xl font-black text-forest uppercase">YOU ARE THE CEO</h2>
          <p className="text-ink font-bold">Your CEO role has been confirmed.</p>
          <p className="text-navy text-sm">Taking you to Startup Name Selection…</p>
        </div>
      )}

      {!revealing && result === 'ended' && (
        <div className="comic-panel text-center flex flex-col items-center gap-3 px-8 py-8" data-testid="result-ended">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-crimson" aria-hidden="true" />
          <h2 className="text-2xl font-black text-ink uppercase">CHALLENGE ENDED</h2>
          <p className="text-ink font-bold">CEOs have been selected for this round.</p>
          <p className="text-navy text-sm">Your score: {score}</p>
          <p className="text-navy text-sm">Please wait for team formation.</p>
          <Link to="/participant" className={`mt-2 ${comicButton('forest', 'sm')}`}>
            Go to dashboard
          </Link>
        </div>
      )}

      {!revealing && result === null && phase === 'CEO_CHALLENGE_ACTIVE' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6" data-testid="challenge-active">
          <h2 className="text-2xl font-black text-ink tracking-tight uppercase">CEO SELECTION CHALLENGE</h2>

          {challengeQuery.isLoading && <LoadingState label="Loading topics…" />}
          {challengeQuery.isError && (
            <ErrorState message={getApiErrorMessage(challengeQuery.error)} onRetry={() => challengeQuery.refetch()} />
          )}

          {!roundActive && challengeQuery.data && (
            <div className="text-center" data-testid="locking-in">
              <p className="text-ink font-black">Locking in your last answer…</p>
              <p className="text-navy text-sm mt-1">Your score: {score}</p>
            </div>
          )}

          {roundActive && currentQuestion && topicPhase === 'answering' && answerEndsAtMs > 0 && (
            <div className="w-full flex flex-col items-center gap-5" data-testid="quiz">
              <p className="text-sm font-black uppercase tracking-wide text-crimson text-center" data-testid="topic-progress">
                Topic {topicIndex + 1} of {questions.length}
              </p>

              <CountdownTimer endsAt={new Date(answerEndsAtMs).toISOString()} serverNow={serverNowIso} />

              <p className="text-lg font-bold text-ink text-center" data-testid="topic-prompt">
                {currentQuestion.question}
              </p>

              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your answer…"
                maxLength={100}
                data-testid="topic-answer-input"
                className="w-full text-center rounded-lg border-[3px] border-ink bg-white px-4 py-3 text-lg font-bold text-ink focus:outline-none focus:ring-2 focus:ring-crimson"
              />
              <p className="text-xs text-navy/60 -mt-2">Your answer locks in automatically when time runs out.</p>

              {submitAnswer.isError && <p className="text-crimson font-bold text-sm text-center">{getApiErrorMessage(submitAnswer.error)}</p>}
            </div>
          )}

          {roundActive && currentQuestion && topicPhase === 'reveal' && (
            <TopicReveal
              questionId={currentQuestion.id}
              questionText={currentQuestion.question}
              topicLabel={`Topic ${topicIndex + 1} of ${questions.length}`}
              revealEndsAtMs={revealEndsAtMs}
              serverNow={serverNowIso}
            />
          )}

          {/* Visible for the whole round, not just one topic's reveal window —
              disappears the instant roundActive flips false (challenge done). */}
          {roundActive && <OverallLeaderboard enabled={roundActive} />}
        </div>
      )}
    </div>
  );
}
