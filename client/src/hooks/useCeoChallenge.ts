import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { CeoTopicReveal, MyCeoChallengeResult, SubmitCeoAnswerResult } from '../types/api';

/** The active topic set for the CEO Selection Competition (req. 48-49) —
 * never includes acceptedAnswers. Who becomes CEO isn't decided by this
 * response; it's decided once the round ends (see RealtimeProvider's
 * challenge:end handler), after every participant's submission is ranked. */
export function useMyCeoChallenge(enabled: boolean) {
  return useQuery({
    queryKey: ['ceo-challenge'],
    queryFn: async () => {
      const { data } = await apiClient.get<MyCeoChallengeResult>('/participant/ceo/challenge');
      return data;
    },
    enabled,
    retry: false,
  });
}

/** Fetched once per topic, exactly when that topic's synchronized answering
 * window closes (see useSyncedTopic's `topicPhase` flipping to `'reveal'`).
 * The server independently re-verifies that window has actually closed
 * before returning the answer — this is never prefetched for topics whose
 * window hasn't closed yet, so there's nothing to leak via dev tools ahead
 * of time (see the backend's getCeoTopicReveal doc comment). Also carries
 * that topic's `leaderboard` — who answered it correctly, fastest-first.
 *
 * Retries a few times on failure: the client flips into the reveal phase
 * the instant ITS OWN clock-corrected timer says the answering window
 * ended, which can be a beat ahead of the server's own authoritative check
 * (ordinary network/processing latency) — the very first request can land
 * just before the server agrees the window is closed and get rejected. A
 * short, bounded retry rides out that race instead of leaving the reveal
 * card permanently blank for the rest of the 5s window.
 *
 * Also refetches every 1.2s for as long as the reveal card stays mounted,
 * rather than trusting the first successful response forever: `leaderboard`
 * / `correctCount` / `totalAnswered` reflect "whoever has submitted SO FAR"
 * (same "not a final settled value" nature as the admin's live answer
 * aggregate), and EVERY participant's client flips into the reveal phase at
 * basically the same synchronized instant — so that very first fetch often
 * lands before almost anyone's (including the viewer's own) answer for this
 * topic has actually committed server-side, making the leaderboard look
 * empty even when plenty of people got it right. Only `correctAnswer` is
 * genuinely static; polling the same endpoint a few more times over the 5s
 * reveal window is a cheap way to let the leaderboard catch up instead of
 * freezing on that near-empty first snapshot. */
export function useCeoTopicReveal(questionId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ceo-challenge-reveal', questionId],
    queryFn: async () => {
      const { data } = await apiClient.get<CeoTopicReveal>(`/participant/ceo/challenge/reveal/${questionId}`);
      return data;
    },
    enabled: enabled && Boolean(questionId),
    retry: 4,
    retryDelay: 400, // 4 retries * 400ms comfortably covers ordinary clock skew within the 5s reveal window
    staleTime: 0,
    refetchInterval: 1200, // stops on its own once the reveal card unmounts at the next topic
  });
}

/** Saves ONE topic's answer immediately — called as each topic's
 * synchronized window closes, not batched to the end of the round. The
 * admin's "stop challenge" ranks whoever is already saved in Postgres at
 * that exact moment, with no wait for stragglers, so this has to be
 * incremental (see participant.service.ts#submitCeoAnswer's doc comment). */
export function useSubmitCeoAnswer() {
  return useMutation({
    mutationFn: async (input: { questionId: string; answer: string }) => {
      const { data } = await apiClient.post<SubmitCeoAnswerResult>('/participant/ceo/answer', input);
      return data;
    },
  });
}
