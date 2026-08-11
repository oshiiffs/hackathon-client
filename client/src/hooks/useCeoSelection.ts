import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import type { SelectCeoResponse } from '../types/api';

/**
 * "Become CEO" — the backend alone decides whether this succeeds (active
 * challenge, before the deadline, nobody selected yet, this user eligible).
 * On success we immediately push the updated role into the auth store so
 * CEO-only routes unlock without requiring a fresh login (Phase 2 already
 * made authorization DB-authoritative server-side; this is the client-side
 * mirror of that — update local state from the server's response instead of
 * forcing a round-trip through /auth/me).
 */
export function useSelectCeo() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<SelectCeoResponse>('/participant/ceo/select');
      return data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(['hackathon-state'], data.state);
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
    },
  });
}
