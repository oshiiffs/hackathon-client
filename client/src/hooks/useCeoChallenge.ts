import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { MyCeoChallengeResult, SubmitCeoAnswerResult } from '../types/api';

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
 * of time (see the backend's getCeoTopicReveal doc comment). */
export function useCeoTopicReveal(questionId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ceo-challenge-reveal', questionId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ questionId: string; correctAnswer: string }>(
        `/participant/ceo/challenge/reveal/${questionId}`,
      );
      return data;
    },
    enabled: enabled && Boolean(questionId),
    retry: false,
    staleTime: Infinity, // a topic's correct answer never changes once fetched
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
