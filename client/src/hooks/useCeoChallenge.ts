import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { MyCeoChallengeResult, SubmitCeoAnswersResult } from '../types/api';

/** The active question set for the CEO Selection Competition (req. 48-49) —
 * never includes correctAnswer. Who becomes CEO isn't decided by this
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

export function useSubmitCeoAnswers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: { questionId: string; selectedOption: number }[]) => {
      const { data } = await apiClient.post<SubmitCeoAnswersResult>('/participant/ceo/submit', { answers });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceo-challenge'] });
    },
  });
}
