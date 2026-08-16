import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { ProjectData, TeamFeedback, TeamOverview } from '../types/api';

export function useTeamOverview(enabled = true) {
  return useQuery({
    queryKey: ['team-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamOverview>('/team/overview');
      return data;
    },
    enabled,
    retry: false,
  });
}

/** Judge feedback — only ever populated once the event is COMPLETE (see
 * getTeamFeedback's doc comment on the backend for why). */
export function useTeamFeedback(enabled = true) {
  return useQuery({
    queryKey: ['team-feedback'],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamFeedback>('/team/feedback');
      return data;
    },
    enabled,
    retry: false,
  });
}

/** CEO-only, and only meaningful once the team is finalized (see renameTeam
 * on the backend) — finalization is what sets the name in the first place. */
export function useRenameTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.patch('/team/name', { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    },
  });
}

/**
 * Collaborative save: any of the five team members can call this (see
 * teamHub.service.ts on the backend) — there is no CEO-only gate on project
 * metadata, only on team-management actions (recruit/department/finalize).
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProjectData>) => {
      const { data } = await apiClient.patch<ProjectData>('/team/project', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    },
  });
}

/** CEO-only, moves the team's submission status from DRAFT to SUBMITTED —
 * requires a finalized team, an uploaded pitch deck, and that admin hasn't
 * locked submissions yet (see submitDeliverable on the backend). */
export function useSubmitDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>('/team/submit');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    },
  });
}
