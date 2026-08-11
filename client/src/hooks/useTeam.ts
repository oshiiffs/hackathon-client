import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { CategoryUsage, Department, Team } from '../types/api';

export function useMyTeam(enabled = true) {
  return useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const { data } = await apiClient.get<Team>('/team/me');
      return data;
    },
    enabled,
    retry: false,
  });
}

export function useCategoryUsage() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<CategoryUsage[]>('/categories');
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useQrBadge(enabled: boolean) {
  return useQuery({
    queryKey: ['qr-badge'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ token: string; userId: string; fullName: string; homeDepartment: Department }>(
        '/me/qr-badge',
      );
      return data;
    },
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });
}

export function useAssignCeoDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (department: Department) => {
      const { data } = await apiClient.post<Team>('/participant/ceo/department', { department });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['my-team'], data);
      queryClient.invalidateQueries({ queryKey: ['hackathon-state'] });
    },
  });
}

export function useRecruitCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (qrToken: string) => {
      const { data } = await apiClient.post<Team>('/team/recruit', { qrToken });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-team'] }),
  });
}

