import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { useHackathonStore } from '../store/hackathonStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type {
  CategoryUpdatedPayload,
  CeoDepartmentAssignedPayload,
  ChallengeEndPayload,
  ChallengeStartPayload,
  FileDeletedPayload,
  FileReplacedPayload,
  FileUploadedPayload,
  HackathonStatePayload,
  MemberRecruitedPayload,
  ParticipantLockPayload,
  ProfileUpdatedPayload,
  SubmissionLockPayload,
  TeamFinalizedPayload,
  TeamUpdatedPayload,
  UserDraftedPayload,
} from '../types/realtime';

/**
 * Sockets are a NOTIFICATION layer only. Postgres (via REST) is the source of
 * truth: whenever a socket event says "something changed", we invalidate the
 * relevant TanStack Query cache so the next render re-fetches real data instead
 * of trusting client-held socket state. This also means a dropped/reconnecting
 * socket never leaves the UI stuck — state.state is re-synced on every reconnect
 * from the server, and REST polling (refetchInterval) is a fallback underneath it.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const queryClient = useQueryClient();
  const setHackathonState = useHackathonStore((s) => s.setState);

  useEffect(() => {
    if (status !== 'authenticated') {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    // Fires immediately on every (re)connection, not just on a real phase
    // change — that's what makes it the right hook for "on reconnect, fetch
    // current team state from the backend" rather than trusting whatever the
    // Team Hub cached before the drop.
    const onState = (payload: HackathonStatePayload) => {
      setHackathonState(payload);
      queryClient.setQueryData(['hackathon-state'], payload);
      queryClient.invalidateQueries({ queryKey: ['admin-hackathon-state'] });
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    };
    const onTeamUpdated = (_payload: TeamUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      queryClient.invalidateQueries({ queryKey: ['judge-teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    };
    // The assigning CEO's own view updates from the REST response (see
    // useAssignCeoDepartment) — this broadcast is for the admin dashboard and
    // any other viewer of this team's roster.
    const onCeoDepartmentAssigned = (_payload: CeoDepartmentAssignedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    };
    const onCategoryUpdated = (_payload: CategoryUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      // The admin HEAT cards read categoryUsage off the overview payload, not
      // the standalone ['categories'] query — keep both in sync.
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    };
    // Finalization is always automatic now (the HEAT Category Selection
    // timer expiring — see team.service.ts's autoFinalizeTeam), so the CEO's
    // own CeoFinalizePage learns about it from this same socket event too,
    // not a REST response. Team name/category aren't sensitive, so this is
    // safe to send to everyone already scoped into this team's room.
    const onTeamFinalized = (_payload: TeamFinalizedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['finalization-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['judge-teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    };
    const onUserDrafted = (_payload: UserDraftedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['admin-participants'] });
    };
    // A participant/CEO's own name or photo changed — the fix for a
    // not-yet-recruited participant's freshly-uploaded avatar never showing
    // up on the Presenter's Scanning Members screen (that data comes from
    // ['admin-participants'], which previously only refreshed on this app's
    // 20s poll — easy to starve if the presenter tab is backgrounded, e.g.
    // cast to a projector but not the focused window). Already-recruited
    // members get their own refresh from onTeamUpdated (broadcastTeamState
    // fires alongside this for anyone with a team); this covers the rest.
    const onProfileUpdated = (_payload: ProfileUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['admin-participants'] });
    };
    // The recruiting CEO's own view updates from the REST response (see
    // useRecruitParticipant) — this broadcast is for the admin dashboard and,
    // crucially, for the recruited participant's OWN already-open socket
    // (moved into the team room by the server the moment they're recruited):
    // if it's about them, refresh their own /auth/me so `user.drafted` flips
    // without waiting for a manual refresh.
    const onMemberRecruited = (payload: MemberRecruitedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-participants'] });
      queryClient.invalidateQueries({ queryKey: ['team-overview'] });
      if (payload.participantId === useAuthStore.getState().user?.id) {
        apiClient
          .get('/auth/me')
          .then(({ data }) => useAuthStore.getState().setUser(data))
          .catch(() => {
            /* best-effort — the next natural refetch/socket event reconciles this */
          });
      }
    };
    // These four are broadcast alongside a full hackathon:state (which already
    // updates the cache above) — they exist mainly so a listener can react to
    // "this specific thing changed" without diffing the whole state object.
    // Here that just means keeping the admin control-center view instantly fresh.
    const onParticipantLock = (_payload: ParticipantLockPayload) => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-state'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hackathon-state'] });
    };
    const onChallengeStart = (_payload: ChallengeStartPayload) => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-state'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hackathon-state'] });
    };
    // The CEO Selection Competition ranks every submission and promotes the
    // top scorers only once the round ends (see hackathon.service.ts's
    // promoteTopScorers) — unlike the old single-winner tap race, a winner
    // never learns their own outcome from a REST response, only from this
    // broadcast. If this client's own user is among the winners, refresh
    // /auth/me the same way onMemberRecruited does for its analogous
    // "this specific user's own state changed" case, so `user.role` flips to
    // CEO without waiting for a manual refresh.
    const onChallengeEnd = (payload: ChallengeEndPayload) => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-state'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hackathon-state'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-participants'] });
      if (payload.winners.some((w) => w.userId === useAuthStore.getState().user?.id)) {
        apiClient
          .get('/auth/me')
          .then(({ data }) => useAuthStore.getState().setUser(data))
          .catch(() => {
            /* best-effort — the next natural refetch/socket event reconciles this */
          });
      }
    };
    const onSubmissionLock = (_payload: SubmissionLockPayload) => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-state'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hackathon-state'] });
    };
    // Team members see a newly uploaded/replaced/deleted file without a
    // manual refresh; admin's deliverable-status view stays live too.
    const onFileUploaded = (payload: FileUploadedPayload) => {
      if (payload.file.type === 'PITCH_DECK') queryClient.invalidateQueries({ queryKey: ['pitch-deck'] });
      else queryClient.invalidateQueries({ queryKey: ['team-files'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
    };
    const onFileReplaced = (_payload: FileReplacedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['pitch-deck'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
    };
    const onFileDeleted = (payload: FileDeletedPayload) => {
      if (payload.type === 'PITCH_DECK') queryClient.invalidateQueries({ queryKey: ['pitch-deck'] });
      else queryClient.invalidateQueries({ queryKey: ['team-files'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deliverables'] });
    };

    socket.on('hackathon:state', onState);
    socket.on('team:updated', onTeamUpdated);
    socket.on('ceo:department-assigned', onCeoDepartmentAssigned);
    socket.on('category:updated', onCategoryUpdated);
    socket.on('team:finalized', onTeamFinalized);
    socket.on('user:drafted', onUserDrafted);
    socket.on('profile:updated', onProfileUpdated);
    socket.on('member:recruited', onMemberRecruited);
    socket.on('participant:locked', onParticipantLock);
    socket.on('participant:unlocked', onParticipantLock);
    socket.on('challenge:start', onChallengeStart);
    socket.on('challenge:end', onChallengeEnd);
    socket.on('submission:locked', onSubmissionLock);
    socket.on('submission:unlocked', onSubmissionLock);
    socket.on('file:uploaded', onFileUploaded);
    socket.on('file:replaced', onFileReplaced);
    socket.on('file:deleted', onFileDeleted);

    return () => {
      socket.off('hackathon:state', onState);
      socket.off('team:updated', onTeamUpdated);
      socket.off('ceo:department-assigned', onCeoDepartmentAssigned);
      socket.off('category:updated', onCategoryUpdated);
      socket.off('team:finalized', onTeamFinalized);
      socket.off('user:drafted', onUserDrafted);
      socket.off('profile:updated', onProfileUpdated);
      socket.off('member:recruited', onMemberRecruited);
      socket.off('participant:locked', onParticipantLock);
      socket.off('participant:unlocked', onParticipantLock);
      socket.off('challenge:start', onChallengeStart);
      socket.off('challenge:end', onChallengeEnd);
      socket.off('submission:locked', onSubmissionLock);
      socket.off('submission:unlocked', onSubmissionLock);
      socket.off('file:uploaded', onFileUploaded);
      socket.off('file:replaced', onFileReplaced);
      socket.off('file:deleted', onFileDeleted);
    };
  }, [status, queryClient, setHackathonState]);

  return children;
}
