import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParticipantDashboardPage } from '../src/pages/participant/ParticipantDashboardPage';
import { useAuthStore } from '../src/store/authStore';
import type { HackathonStatePayload, PublicUser } from '../src/types/api';

function mockUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'user_1',
    fullName: 'Ada Lovelace',
    email: null,
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'PARTICIPANT',
    drafted: false,
    teamId: null,
    nickname: null,
    bio: null,
    skills: [],
    avatarUrl: null,
    ...overrides,
  };
}

function mockState(overrides: Partial<HackathonStatePayload> = {}): HackathonStatePayload {
  return {
    phase: 'LOBBY',
    phaseLabel: 'WAITING',
    participantsLocked: true,
    currentChallengeRound: 0,
    ceoSlotsForCurrentRound: 0,
    challengeDurationSeconds: 30,
    challengeStartedAt: null,
    challengeEndsAt: null,
    submissionsLocked: false,
    allowIncompleteTeams: false,
    serverNow: new Date().toISOString(),
    ...overrides,
  };
}

// The real /participant/challenge route renders ParticipantChallengePage (see
// challenge.test.tsx for that page's own behavior) — here we only care whether
// ParticipantDashboardPage correctly hands off to it, so a marker is enough.
function ChallengePageMarker() {
  return <div data-testid="challenge-page-marker">challenge page</div>;
}

function renderParticipant(state: HackathonStatePayload, user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['hackathon-state'], state);
  queryClient.setQueryData(['qr-badge'], {
    token: 'mock-token',
    userId: user.id,
    fullName: user.fullName,
    homeDepartment: user.homeDepartment,
  });
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/participant']}>
        <Routes>
          <Route path="/participant" element={<ParticipantDashboardPage />} />
          <Route path="/participant/challenge" element={<ChallengePageMarker />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('Participant dashboard — server-driven states', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
  });

  it('shows the WAITING screen with the exact required copy when the event has not started', () => {
    renderParticipant(mockState({ phase: 'LOBBY', phaseLabel: 'WAITING', participantsLocked: true }));
    expect(screen.getByTestId('waiting-screen')).toBeInTheDocument();
    expect(screen.getByText('HACKATHON 2026')).toBeInTheDocument();
    expect(screen.getByText('PLEASE WAIT')).toBeInTheDocument();
    expect(screen.getByText('The challenge has not started.')).toBeInTheDocument();
  });

  it('shows the locked/standby screen whenever participantsLocked is true, even in a later phase', () => {
    // Locking is independent of phase — an admin can re-lock at any point.
    renderParticipant(mockState({ phase: 'DRAFTING', phaseLabel: 'TEAM_FORMATION', participantsLocked: true }));
    expect(screen.getByTestId('waiting-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('candidate-screen')).not.toBeInTheDocument();
  });

  it('hands off to /participant/challenge once unlocked and the challenge becomes active', async () => {
    renderParticipant(
      mockState({
        phase: 'CEO_CHALLENGE_ACTIVE',
        phaseLabel: 'CEO_CHALLENGE',
        participantsLocked: false,
        currentChallengeRound: 1,
        challengeEndsAt: new Date(Date.now() + 30000).toISOString(),
      }),
    );
    // The actual challenge UI (button, countdown, result states) is exercised
    // directly on ParticipantChallengePage in challenge.test.tsx.
    expect(await screen.findByTestId('challenge-page-marker')).toBeInTheDocument();
  });

  it('shows "CHALLENGE ENDED" on the candidate screen once unlocked outside an active challenge round', () => {
    renderParticipant(mockState({ phase: 'DRAFTING', phaseLabel: 'TEAM_FORMATION', participantsLocked: false, currentChallengeRound: 1 }));
    expect(screen.getByTestId('candidate-screen')).toBeInTheDocument();
    expect(screen.getByText('CHALLENGE ENDED')).toBeInTheDocument();
  });

  it('reacts live when the hackathon-state cache is updated (the same mechanism the socket handler uses)', async () => {
    const queryClient = renderParticipant(mockState({ phase: 'LOBBY', participantsLocked: true }));
    expect(screen.getByTestId('waiting-screen')).toBeInTheDocument();

    // This is exactly what RealtimeProvider's `hackathon:state` socket handler
    // does on a real push from the server — set the query cache directly.
    act(() => {
      queryClient.setQueryData(
        ['hackathon-state'],
        mockState({ phase: 'DRAFTING', phaseLabel: 'TEAM_FORMATION', participantsLocked: false, currentChallengeRound: 1 }),
      );
    });

    // TanStack Query's notify manager flushes subscriber updates via a
    // macrotask, not a microtask — findBy's built-in polling waits for that,
    // where a synchronous getBy right after act() would not.
    expect(await screen.findByTestId('candidate-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('waiting-screen')).not.toBeInTheDocument();
  });
});
