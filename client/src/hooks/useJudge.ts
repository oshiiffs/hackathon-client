import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type {
  EvaluationPayload,
  EvaluationStatus,
  HeatCategory,
  JudgeCriteriaResponse,
  JudgeTeamDetail,
  JudgeTeamListItem,
} from '../types/api';

export function useJudgeCriteria() {
  return useQuery({
    queryKey: ['judge-criteria'],
    queryFn: async () => {
      const { data } = await apiClient.get<JudgeCriteriaResponse>('/judge/criteria');
      return data;
    },
    staleTime: Infinity, // authoritative and static for the whole event
  });
}

export type JudgeTeamFilters = { search?: string; category?: HeatCategory; status?: EvaluationStatus };

export function useJudgeTeams(filters: JudgeTeamFilters) {
  return useQuery({
    queryKey: ['judge-teams', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teams: JudgeTeamListItem[] }>('/judge/teams', { params: filters });
      return data.teams;
    },
    refetchInterval: 8000,
  });
}

export function useJudgeTeamDetail(teamId: string | null) {
  return useQuery({
    queryKey: ['judge-team', teamId],
    queryFn: async () => {
      const { data } = await apiClient.get<JudgeTeamDetail>(`/judge/teams/${teamId}`);
      return data;
    },
    enabled: teamId !== null,
  });
}

export function useSaveDraftEvaluation(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scores: Record<string, number>; comments?: string }) => {
      const { data } = await apiClient.put<EvaluationPayload>(`/judge/teams/${teamId}/evaluation`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['judge-teams'] });
    },
  });
}

export function useSubmitEvaluation(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scores: Record<string, number>; comments?: string }) => {
      const { data } = await apiClient.post<EvaluationPayload>(`/judge/teams/${teamId}/evaluation/submit`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['judge-teams'] });
    },
  });
}
