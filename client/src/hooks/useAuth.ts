import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket } from '../lib/socket';
import type { PublicUser } from '../types/api';

type LoginPayload = { accessCode: string } | { email: string; password: string };
type LoginResponse = { user: PublicUser };

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: LoginPayload) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', input);
      return data;
    },
    onSuccess: (data) => setUser(data.user),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSettled: () => {
      clear();
      disconnectSocket();
      queryClient.clear();
    },
  });
}

/** Used once on app load to restore the session from the httpOnly cookie — see
 * components/SessionBootstrap.tsx. Not used for rendering directly. */
export function useCurrentUserQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await apiClient.get<PublicUser>('/auth/me');
      return data;
    },
    enabled,
    retry: false,
  });
}
