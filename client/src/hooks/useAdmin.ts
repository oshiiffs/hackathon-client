import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../lib/apiClient';
import { showErrorToast, showSuccessToast } from '../store/toastStore';
import type {
  AdminEvaluationOverview,
  AdminHackathonStatePayload,
  AdminOverview,
  Department,
  Team,
  TeamDeliverableStatus,
} from '../types/api';

type AdminParticipant = {
  id: string;
  fullName: string;
  homeDepartment: Department;
  slotDepartment: Department | null;
  role: string;
  drafted: boolean;
  teamId: string | null;
  isCeoWinner: boolean;
  createdAt: string;
};

// The Admin Dashboard mounts all six of these at once. Sockets (see
// RealtimeProvider) already invalidate every one of these query keys the
// instant something actually changes, and every admin mutation invalidates
// them again on success — so this refetchInterval is only a fallback for a
// silently dropped socket, not the primary sync path. Six queries polling
// every 4-8s each was overkill for that role and made the whole dashboard
// re-render every couple of seconds even when nothing changed; widened to
// stay comfortably ahead of any real staleness without the constant churn.
export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminOverview>('/admin/overview');
      return data;
    },
    refetchInterval: 20000,
  });
}

export function useAdminHackathonState() {
  return useQuery({
    queryKey: ['admin-hackathon-state'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminHackathonStatePayload>('/admin/hackathon/state');
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useAdminTeams() {
  return useQuery({
    queryKey: ['admin-teams'],
    queryFn: async () => {
      const { data } = await apiClient.get<Team[]>('/admin/teams');
      return data;
    },
    refetchInterval: 20000,
  });
}

export function useAdminDeliverables() {
  return useQuery({
    queryKey: ['admin-deliverables'],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamDeliverableStatus[]>('/admin/deliverables');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useAdminEvaluations() {
  return useQuery({
    queryKey: ['admin-evaluations'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminEvaluationOverview[]>('/admin/evaluations');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useAdminParticipants() {
  return useQuery({
    queryKey: ['admin-participants'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminParticipant[]>('/admin/participants');
      return data;
    },
    refetchInterval: 20000,
  });
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-hackathon-state'] });
    queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
    queryClient.invalidateQueries({ queryKey: ['admin-participants'] });
    queryClient.invalidateQueries({ queryKey: ['hackathon-state'] });
  };
}

export function useCreateParticipant() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (input: { fullName: string; homeDepartment: Department; accessCode?: string }) => {
      const { data } = await apiClient.post('/admin/participants', input);
      return data;
    },
    onSuccess: invalidate,
  });
}

// Admin can only reassign department — fullName is participant-owned (see
// useUpdateMyName in useAuth.ts), so it's not accepted here.
export function useUpdateParticipant() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async ({ id, homeDepartment }: { id: string; homeDepartment: Department }) => {
      const { data } = await apiClient.patch(`/admin/participants/${id}`, { homeDepartment });
      return data;
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast('Participant updated.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useDeleteParticipant() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/participants/${id}`);
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast('Participant removed.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useRegenerateAccessCode() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<{ id: string; fullName: string; accessCode: string }>(
        `/admin/participants/${id}/regenerate-code`,
      );
      return data;
    },
    onSuccess: invalidate,
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useCreateStaff() {
  return useMutation({
    mutationFn: async (input: { fullName: string; email: string; password: string; role: 'ADMIN' | 'JUDGE' }) => {
      const { data } = await apiClient.post('/admin/staff', input);
      return data;
    },
    onSuccess: (_, input) => showSuccessToast(`${input.role === 'JUDGE' ? 'Judge' : 'Admin'} account created for ${input.email}.`),
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

/** Every hackathon-control mutation shares the same shape: hit an
 * /admin/hackathon/* endpoint, refresh the admin queries, and surface a
 * success/error toast. Centralized here so each action doesn't repeat it. */
function useHackathonControlMutation(url: string, successMessage: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (payload?: Record<string, unknown>) => {
      const { data } = await apiClient.post<AdminHackathonStatePayload>(url, payload);
      return data;
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast(successMessage);
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useLockParticipants() {
  return useHackathonControlMutation('/admin/hackathon/lock-participants', 'Participants locked.');
}

export function useUnlockParticipants() {
  return useHackathonControlMutation('/admin/hackathon/unlock-participants', 'Participants unlocked.');
}

export function useStartCeoChallenge() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (input: { durationSeconds: number; ceoSlots: number }) => {
      const { data } = await apiClient.post<AdminHackathonStatePayload>('/admin/hackathon/challenge/start', input);
      return data;
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast('CEO challenge started.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useStopCeoChallenge() {
  return useHackathonControlMutation('/admin/hackathon/challenge/stop', 'CEO challenge stopped.');
}

export function useOpenSubmissions() {
  return useHackathonControlMutation('/admin/hackathon/submissions/open', 'Submissions opened.');
}

export function useLockSubmissions() {
  return useHackathonControlMutation('/admin/hackathon/submissions/lock', 'Submissions locked.');
}

export function useCompleteEvent() {
  return useHackathonControlMutation('/admin/hackathon/complete', 'Event marked complete.');
}
