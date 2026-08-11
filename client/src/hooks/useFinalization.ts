import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { FinalizationStatus, HeatCategory, Team } from '../types/api';

export function useFinalizationStatus(enabled = true) {
  return useQuery({
    queryKey: ['finalization-status'],
    queryFn: async () => {
      const { data } = await apiClient.get<FinalizationStatus>('/participant/ceo/finalization');
      return data;
    },
    enabled,
    retry: false,
  });
}

/**
 * The backend re-validates everything from scratch (roster, name, category
 * capacity) — this call can still fail even if the finalization-status page
 * just showed "ready", since time passes before a CEO confirms.
 */
export function useFinalizeTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category: HeatCategory }) => {
      const { data } = await apiClient.post<Team>('/participant/ceo/finalize', input);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['my-team'], data);
      queryClient.invalidateQueries({ queryKey: ['finalization-status'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
