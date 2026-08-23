import { useEffect, useRef, useState } from 'react';

// Must match the server's REVEAL_SECONDS in hackathon.service.ts's
// startCeoChallenge — how long each topic's correct answer is shown before
// the synchronized clock advances to the next topic.
const REVEAL_SECONDS = 5;

export type TopicPhase = 'answering' | 'reveal';

export type SyncedTopicState = {
  topicIndex: number;
  topicPhase: TopicPhase;
  answerEndsAtMs: number; // when this topic's countdown/input closes
  revealEndsAtMs: number; // when the reveal window ends == next topic's start
  roundOver: boolean;
  // A continuously fresh "corrected current time," safe to hand to
  // CountdownTimer at ANY point — including a remount partway through the
  // round (e.g. the reveal card mounting fresh each topic). CountdownTimer
  // derives its own clock-skew offset once, at ITS mount time, by comparing
  // whatever `serverNow` it's given against `Date.now()` right then — so
  // passing the ONE-TIME snapshot this hook originally received (e.g. a
  // React Query result fetched only once, at page load) would make that
  // offset increasingly wrong for every later remount, since real time keeps
  // moving but that snapshot doesn't. Recomputing this every render from the
  // same stable `offsetRef` this hook already maintains keeps it accurate
  // no matter when a consumer's CountdownTimer instance actually mounts.
  serverNowIso: string;
};

/**
 * Shared by ParticipantChallengePage and PresenterPage so both derive
 * identical topic/phase timing from the same server timestamps — neither
 * gets a server push between topics; only a single upfront fetch
 * (challengeStartedAt + per-topic challengeDurationSeconds) plus this
 * client-side clock decides "what's showing right now," so any drift
 * between the two implementations would desync the big screen from what
 * participants actually see.
 *
 * Each topic cycles through an `answering` window (`durationSeconds`) then a
 * `reveal` window (`REVEAL_SECONDS`, showing the correct answer) before
 * advancing to the next topic.
 */
export function useSyncedTopic(
  startedAt: string | null | undefined,
  durationSeconds: number,
  serverNow: string | undefined,
  totalTopics: number,
): SyncedTopicState {
  const [, forceTick] = useState(0);
  const offsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (serverNow && offsetRef.current === null) {
      offsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, [serverNow]);

  // Only worth ticking while there's an actual round to sync against — both
  // consumers (ParticipantChallengePage, PresenterPage) render the same
  // fixed "no round" state below regardless of how often this re-renders
  // when `startedAt` is null, so a 5x/sec forced re-render then is pure
  // waste. Matters most for PresenterPage, which can sit mounted on a
  // projector for the whole multi-hour event — most of that time with no
  // CEO Challenge round active at all.
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 200);
    return () => clearInterval(interval);
  }, [startedAt]);

  const offset = offsetRef.current ?? 0;
  const nowCorrected = Date.now() + offset;

  if (!startedAt || totalTopics === 0) {
    return {
      topicIndex: 0,
      topicPhase: 'answering',
      answerEndsAtMs: 0,
      revealEndsAtMs: 0,
      roundOver: false,
      serverNowIso: new Date(nowCorrected).toISOString(),
    };
  }
  const startedAtMs = new Date(startedAt).getTime();
  const answerMs = durationSeconds * 1000;
  const cycleMs = answerMs + REVEAL_SECONDS * 1000;
  const elapsedMs = Math.max(0, nowCorrected - startedAtMs);
  const rawIndex = Math.floor(elapsedMs / cycleMs);
  const topicIndex = Math.min(rawIndex, totalTopics - 1);
  const cycleStartMs = startedAtMs + topicIndex * cycleMs;
  const answerEndsAtMs = cycleStartMs + answerMs;
  const revealEndsAtMs = cycleStartMs + cycleMs;
  const topicPhase: TopicPhase = nowCorrected < answerEndsAtMs ? 'answering' : 'reveal';
  const roundOver = rawIndex >= totalTopics;

  return {
    topicIndex,
    topicPhase,
    answerEndsAtMs,
    revealEndsAtMs,
    roundOver,
    serverNowIso: new Date(nowCorrected).toISOString(),
  };
}
