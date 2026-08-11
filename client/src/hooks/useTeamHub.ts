import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { ProjectData, TeamOverview } from '../types/api';

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
