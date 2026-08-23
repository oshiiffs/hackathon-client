import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket } from '../lib/socket';
import type { PublicUser } from '../types/api';

type LoginPayload = { accessCode: string } | { email: string; password: string };
type LoginResponse = { user: PublicUser };

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginPayload) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', input);
      return data;
    },
    // This is a shared-kiosk app — the same browser/tab logs in as a
    // different person all day (one participant's badge code, then the
    // next). Every query is keyed WITHOUT a user id (['my-qr'], ['my-team'],
    // etc. — see useQr.ts's useMyQr) on the assumption that a login always
    // starts from a clean cache, same as useLogout's queryClient.clear()
    // already guarantees on the way out. Without this, a query that errored
    // (or a stale success) for whoever used this device last stays cached
    // and gets served straight to the next person who logs in — e.g. a
    // previous non-participant's "only participants have a recruitment QR
    // code" 403, shown to a genuinely eligible participant who just signed
    // in right after them.
    onSuccess: (data) => {
      queryClient.clear();
      setUser(data.user);
    },
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

export type UpdateMyProfileInput = {
  fullName?: string;
  nickname?: string | null;
  bio?: string | null;
  skills?: string[];
};

/** Self-service profile edit (participants/CEOs only — see auth.service.ts).
 * Any subset of fields may be sent; only what's included is changed. */
export function useUpdateMyProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: UpdateMyProfileInput) => {
      const { data } = await apiClient.patch<PublicUser>('/auth/me', input);
      return data;
    },
    onSuccess: (data) => setUser(data),
  });
}

export function useUploadAvatar() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<PublicUser>('/auth/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => setUser(data),
  });
}
