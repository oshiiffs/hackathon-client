import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../lib/apiClient';
import type { ParticipantBadge } from '../lib/participantBadges';
import { showErrorToast, showSuccessToast } from '../store/toastStore';
import type {
  AdminEvaluationOverview,
  AdminHackathonStatePayload,
  AdminOverview,
  AdminTeamResources,
  CeoChallengeLeaderboardEntry,
  CeoQuestion,
  Department,
  LeaderboardEntry,
  LiveAnswerAggregate,
  QrIdentity,
  StaffAccount,
  Team,
  TeamDeliverableStatus,
} from '../types/api';

export type AdminParticipant = {
  id: string;
  fullName: string;
  homeDepartment: Department;
  slotDepartment: Department | null;
  role: string;
  drafted: boolean;
  teamId: string | null;
  isCeoWinner: boolean;
  avatarUrl: string | null;
  createdAt: string;
};

type EventExport = {
  exportedAt: string;
  participants: AdminParticipant[];
  teams: Team[];
  judgeScores: {
    id: string;
    innovation: number;
    feasibility: number;
    impact: number;
    presentation: number;
    comments: string | null;
    status: string;
    submittedAt: string | null;
    createdAt: string;
    judge: { id: string; fullName: string };
    team: { id: string; name: string | null; category: string | null };
  }[];
};

// The Admin Dashboard mounts all six of these at once. Sockets (see
// RealtimeProvider) already invalidate every one of these query keys the
// instant something actually changes, and every admin mutation invalidates
// them again on success — so this refetchInterval is only a fallback for a
// silently dropped socket, not the primary sync path. Six queries polling
// every 4-8s each was overkill for that role and made the whole dashboard
// re-render every couple of seconds even when nothing changed; widened to
// stay comfortably ahead of any real staleness without the constant churn.
export function useAdminOverview(enabled = true) {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminOverview>('/admin/overview');
      return data;
    },
    refetchInterval: 20000,
    enabled,
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

// `enabled` (default true) lets a caller that stays mounted for hours —
// PresenterPage's big-screen view, open on a projector for the whole event —
// skip the network round trip and refetch timer entirely while its own
// current phase has no use for this particular data, rather than polling
// every consumer's queries unconditionally regardless of what's on screen.
// AdminDashboardPage and other always-relevant callers are unaffected, since
// they never pass anything other than the default.
export function useAdminDeliverables(enabled = true) {
  return useQuery({
    queryKey: ['admin-deliverables'],
    queryFn: async () => {
      const { data } = await apiClient.get<TeamDeliverableStatus[]>('/admin/deliverables');
      return data;
    },
    refetchInterval: 30000,
    enabled,
  });
}

export function useAdminEvaluations(enabled = true) {
  return useQuery({
    queryKey: ['admin-evaluations'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminEvaluationOverview[]>('/admin/evaluations');
      return data;
    },
    refetchInterval: 30000,
    enabled,
  });
}

export function useAdminLeaderboard(enabled = true) {
  return useQuery({
    queryKey: ['admin-leaderboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeaderboardEntry[]>('/admin/leaderboard');
      return data;
    },
    refetchInterval: 15000,
    enabled,
  });
}

export function useAdminParticipants(enabled = true) {
  return useQuery({
    queryKey: ['admin-participants'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminParticipant[]>('/admin/participants');
      return data;
    },
    refetchInterval: 20000,
    enabled,
  });
}

export function useAdminStaff() {
  return useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<StaffAccount[]>('/admin/staff');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useAdminTeamResources(teamId: string | null) {
  return useQuery({
    queryKey: ['admin-team-resources', teamId],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminTeamResources>(`/admin/teams/${teamId}/resources`);
      return data;
    },
    enabled: teamId !== null,
  });
}

export function useAdminDeleteTeamFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, fileId }: { teamId: string; fileId: string }) => {
      await apiClient.delete(`/admin/teams/${teamId}/files/${fileId}`);
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-team-resources', teamId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
      showSuccessToast('File removed.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useAdminDeletePitchDeckVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, versionId }: { teamId: string; versionId: string }) => {
      await apiClient.delete(`/admin/teams/${teamId}/pitch-deck/${versionId}`);
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-team-resources', teamId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
      showSuccessToast('Pitch deck version removed.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

/** Admin's "undo this team" cleanup tool — deletes it outright, frees its
 * HEAT category slot, and returns every member (CEO included) to a fresh,
 * undrafted PARTICIPANT (see the server's deleteTeam doc comment). Uses the
 * shared invalidate helper since this touches the roster, category capacity,
 * AND overview counts all at once. */
export function useAdminDeleteTeam() {
  const invalidate = useInvalidateAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      await apiClient.delete(`/admin/teams/${teamId}`);
    },
    onSuccess: (_, teamId) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
      queryClient.invalidateQueries({ queryKey: ['admin-evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-team-resources', teamId] });
      showSuccessToast('Team deleted.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

/** Worst-case-headcount escape hatch — lets CEOs finalize with fewer than 5
 * members once the admin flips this on (still capped at one per department). */
export function useSetAllowIncompleteTeams() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (allow: boolean) => {
      const { data } = await apiClient.post<AdminHackathonStatePayload>('/admin/hackathon/allow-incomplete-teams', { allow });
      return data;
    },
    onSuccess: (data) => {
      invalidate();
      showSuccessToast(data.allowIncompleteTeams ? 'Incomplete teams are now allowed to finalize.' : 'Incomplete teams can no longer finalize.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

/** The two buttonless team-finalization timer durations (CEO Name Selection,
 * HEAT Category Selection) — only affects timers not yet started for any
 * given team (see team.service.ts's getFinalizationStatus). */
export function useSetFinalizeTimers() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (input: { ceoNameSelectionSeconds: number; heatCategorySelectionSeconds: number }) => {
      const { data } = await apiClient.post<AdminHackathonStatePayload>('/admin/hackathon/finalize-timers', input);
      return data;
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast('Team finalization timers updated.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

/** Live "top 5 answers" for one topic, for the presenter/LCD view — poll
 * while that topic is on screen, not otherwise. */
export function useLiveAnswerAggregate(questionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['live-answer-aggregate', questionId],
    queryFn: async () => {
      const { data } = await apiClient.get<LiveAnswerAggregate>(`/admin/hackathon/challenge/answers/${questionId}`);
      return data;
    },
    enabled: enabled && questionId !== null,
    refetchInterval: enabled ? 1500 : false,
  });
}

/** Dedicated presenter tab — see the backend's getCeoChallengeLeaderboard. */
export function useCeoChallengeLeaderboard(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-ceo-challenge-leaderboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<CeoChallengeLeaderboardEntry[]>('/admin/hackathon/challenge/leaderboard');
      return data;
    },
    enabled,
    refetchInterval: enabled ? 3000 : false,
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

/** A participant's own QR badge (see /participant/qr, used by the participant
 * themselves), fetched here for an arbitrary participant by an admin — e.g.
 * to reprint/redisplay a lost or damaged physical badge. Requires a matching
 * `GET /admin/participants/:id/qr` route on the server returning the same
 * `{ qrToken, qrPayload }` shape as the participant-facing endpoint; this
 * client only calls it; it doesn't mint tokens itself (qrPayload is a
 * server-signed token, see QR_TOKEN_SECRET in the server's .env.example). */
export function useAdminParticipantQr(participantId: string | null) {
  return useQuery({
    queryKey: ['admin-participant-qr', participantId],
    queryFn: async () => {
      const { data } = await apiClient.get<QrIdentity>(`/admin/participants/${participantId}/qr`);
      return data;
    },
    enabled: Boolean(participantId),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });
}

/** One-shot fetch (not a live-polled query) for bulk badge-printing — see
 * getParticipantBadges on the server and lib/participantBadges.ts's
 * downloadParticipantBadgesPdf, which the caller feeds this with. */
export function useFetchParticipantBadges() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<ParticipantBadge[]>('/admin/participants/badges');
      return data;
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fullName: string; email: string; password: string; role: 'ADMIN' | 'JUDGE' }) => {
      const { data } = await apiClient.post('/admin/staff', input);
      return data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      showSuccessToast(`${input.role === 'JUDGE' ? 'Judge' : 'Admin'} account created for ${input.email}.`);
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; fullName?: string; email?: string; role?: 'ADMIN' | 'JUDGE' }) => {
      const { data } = await apiClient.patch<StaffAccount>(`/admin/staff/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      showSuccessToast('Staff account updated.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      showSuccessToast('Staff account removed.');
    },
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

/** Read-only snapshot for the "New Competition" archive-then-wipe flow — a
 * mutation (not a query) since it's only ever triggered on demand by that
 * button, never rendered/polled on its own. */
export function useExportEventData() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<EventExport>('/admin/export');
      return data;
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

/** Terminal-phase-only hard reset — wipes the current event's participants/
 * teams/submissions/scores and puts HackathonState back to LOBBY. The caller
 * is expected to have already pulled useExportEventData for an archive. */
export function useResetCompetition() {
  const invalidate = useInvalidateAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<AdminHackathonStatePayload>('/admin/hackathon/reset');
      return data;
    },
    onSuccess: () => {
      invalidate();
      // Full wipe empties these too — the shared invalidate() above doesn't
      // touch them since routine hackathon-control actions never affect them.
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
      queryClient.invalidateQueries({ queryKey: ['admin-evaluations'] });
      showSuccessToast('New competition started — event reset to the lobby.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

// ---------- CEO Selection Competition question bank (req. 41-53) ----------

export function useCeoQuestions(enabled = true) {
  return useQuery({
    queryKey: ['admin-ceo-questions'],
    queryFn: async () => {
      const { data } = await apiClient.get<CeoQuestion[]>('/admin/ceo-questions');
      return data;
    },
    refetchInterval: 20000,
    enabled,
  });
}

type CeoQuestionInput = {
  question: string;
  acceptedAnswers: string[];
  points: number;
  category?: string;
  order: number;
  isActive: boolean;
};

function useInvalidateCeoQuestions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin-ceo-questions'] });
    // Active count feeds the Main Controller's READY/NOT READY gate.
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };
}

export function useCreateCeoQuestion() {
  const invalidate = useInvalidateCeoQuestions();
  return useMutation({
    mutationFn: async (input: CeoQuestionInput) => {
      const { data } = await apiClient.post<CeoQuestion>('/admin/ceo-questions', input);
      return data;
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast('Question added.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useUpdateCeoQuestion() {
  const invalidate = useInvalidateCeoQuestions();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CeoQuestionInput> & { id: string }) => {
      const { data } = await apiClient.patch<CeoQuestion>(`/admin/ceo-questions/${id}`, input);
      return data;
    },
    onSuccess: invalidate,
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export function useDeleteCeoQuestion() {
  const invalidate = useInvalidateCeoQuestions();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/ceo-questions/${id}`);
    },
    onSuccess: () => {
      invalidate();
      showSuccessToast('Question deleted.');
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

// ---------- Cloudinary maintenance (one-off, HTTP-triggerable versions of
// the server's scripts/*.ts — see cloudinaryMaintenance.service.ts on the
// backend for why: Render's Shell tab needs a paid plan this deployment
// doesn't have, so these run the same logic over a normal admin-gated
// HTTP call instead). ----------

export type MigrateRawAuthResult = {
  migrated: number;
  alreadyDone: number;
  failed: number;
  total: number;
  failures: { label: string; error?: string }[];
};

export function useMigrateRawAuth() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<MigrateRawAuthResult>('/admin/cloudinary/migrate-raw-auth');
      return data;
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}

export type DiagnoseRawDeliveryResult = {
  cloudName?: string;
  apiKeyPrefix?: string;
  upload: { publicId: string };
  adminApi: { type: string | null; accessMode: string | null; error: string | null };
  signedUrl: string;
  delivery: { httpStatus: number; cldError: string | null; bodyPreview: string };
  cleanedUp: boolean;
  verdict: string;
};

export function useDiagnoseRawDelivery() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<DiagnoseRawDeliveryResult>('/admin/cloudinary/diagnose-raw-delivery');
      return data;
    },
    onError: (err) => showErrorToast(getApiErrorMessage(err)),
  });
}
