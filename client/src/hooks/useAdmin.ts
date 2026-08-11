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

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminOverview>('/admin/overview');
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useAdminHackathonState() {
  return useQuery({
    queryKey: ['admin-hackathon-state'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminHackathonStatePayload>('/admin/hackathon/state');
      return data;
    },
    refetchInterval: 4000,
  });
}

export function useAdminTeams() {
  return useQuery({
    queryKey: ['admin-teams'],
    queryFn: async () => {
      const { data } = await apiClient.get<Team[]>('/admin/teams');
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useAdminDeliverables() {
  return useQuery({
    queryKey: ['admin-deliverables'],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamDeliverableStatus[]>('/admin/deliverables');
      return data;
    },
    refetchInterval: 8000,
  });
}

export function useAdminEvaluations() {
  return useQuery({
    queryKey: ['admin-evaluations'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminEvaluationOverview[]>('/admin/evaluations');
      return data;
    },
    refetchInterval: 8000,
  });
}

export function useAdminParticipants() {
  return useQuery({
    queryKey: ['admin-participants'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminParticipant[]>('/admin/participants');
      return data;
    },
    refetchInterval: 8000,
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
