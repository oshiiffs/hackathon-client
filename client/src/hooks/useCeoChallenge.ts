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
