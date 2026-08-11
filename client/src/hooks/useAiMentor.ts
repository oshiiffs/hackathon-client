import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { AiSendMessageResponse, AiSessionDetail, AiSessionSummary } from '../types/api';

export function useAiSessions() {
  return useQuery({
    queryKey: ['ai-sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get<AiSessionSummary[]>('/team/ai/sessions');
      return data;
    },
  });
}

export function useAiSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['ai-sessions', sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get<AiSessionDetail>(`/team/ai/sessions/${sessionId}`);
      return data;
    },
    enabled: sessionId !== null,
  });
}

export function useCreateAiSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const { data } = await apiClient.post<AiSessionSummary>('/team/ai/sessions', { title });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-sessions'] }),
  });
}

export function useDeleteAiSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(`/team/ai/sessions/${sessionId}`);
      return sessionId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-sessions'] }),
  });
}

export function useSendAiMessage(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await apiClient.post<AiSendMessageResponse>(`/team/ai/sessions/${sessionId}/messages`, { message });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
    },
  });
}
