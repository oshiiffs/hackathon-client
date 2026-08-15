import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ParticipantChallengePage } from '../src/pages/participant/ParticipantChallengePage';
import { CeoDashboardPage } from '../src/pages/ceo/CeoDashboardPage';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { HackathonStatePayload, PublicUser, SelectCeoResponse, Team } from '../src/types/api';

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
    phase: 'CEO_CHALLENGE_ACTIVE',
    phaseLabel: 'CEO_CHALLENGE',
    participantsLocked: false,
    currentChallengeRound: 1,
    ceoSlotsForCurrentRound: 0,
    challengeDurationSeconds: 30,
    challengeStartedAt: new Date().toISOString(),
    challengeEndsAt: new Date(Date.now() + 30000).toISOString(),
    submissionsLocked: false,
    allowIncompleteTeams: false,
    serverNow: new Date().toISOString(),
    ...overrides,
  };
}

function mockTeam(overrides: Partial<Team> = {}): Team {
  const ceoMember = {
    id: 'user_1',
    fullName: 'Ada Lovelace',
    homeDepartment: 'CCS' as const,
    slotDepartment: null,
    role: 'CEO' as const,
  };
  return {
    id: 'team_1',
    name: null,
    ceoId: 'user_1',
    ceo: ceoMember,
    members: [ceoMember],
    category: null,
    isComplete: false,
    finalizedAt: null,
    deliverable: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function axiosErrorWithCode(code: string) {
  return new AxiosError(
    'Request failed',
    '409',
    { headers: new AxiosHeaders(), method: 'post', url: '/participant/ceo/select' },
    {},
    {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { code, message: 'nope' } },
    },
  );
}

function renderChallenge(state: HackathonStatePayload, user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['hackathon-state'], state);
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/participant/challenge']}>
        <ParticipantChallengePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

function renderCeoPage(team: Team, user: PublicUser, state: HackathonStatePayload) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['my-team'], team);
  queryClient.setQueryData(['hackathon-state'], state);
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ceo']}>
        <CeoDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CEO selection flow', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. shows the BECOME CEO button and a server-driven MM:SS countdown while the challenge is active', () => {
    renderChallenge(mockState({ challengeEndsAt: new Date(Date.now() + 65000).toISOString() }));
    expect(screen.getByTestId('become-ceo-button')).toHaveTextContent('BECOME CEO');
    expect(screen.getByTestId('countdown-timer')).toHaveTextContent(/\d{2}:\d{2}/);
  });

  it('2. hides the button and shows the success view once selection succeeds', async () => {
    const user = userEvent.setup();
    const response: SelectCeoResponse = {
      becameCeo: true,
      team: { id: 'team_1', ceoId: 'user_1' },
      user: mockUser({ role: 'CEO' }),
      state: mockState({ phase: 'DRAFTING', phaseLabel: 'TEAM_FORMATION' }),
    };
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: response } as never);

    renderChallenge(mockState());
    await user.click(screen.getByTestId('become-ceo-button'));

    expect(await screen.findByTestId('result-success')).toBeInTheDocument();
    expect(screen.queryByTestId('become-ceo-button')).not.toBeInTheDocument();
  });

  it('3. disables the button and shows a loading label while the request is in flight, preventing duplicate submissions', async () => {
    const user = userEvent.setup();
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockReturnValueOnce(pending as never);

    renderChallenge(mockState());
    const button = screen.getByTestId('become-ceo-button');
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Submitting…');
    expect(postSpy).toHaveBeenCalledTimes(1);

    // Resolve so the pending promise doesn't leak into the next test.
    resolveRequest({
      data: {
        becameCeo: true,
        team: { id: 'team_1', ceoId: 'user_1' },
        user: mockUser({ role: 'CEO' }),
        state: mockState({ phase: 'DRAFTING' }),
      },
    });
  });

  it('4. updates the auth store role to CEO on success, without a fresh login', async () => {
    const user = userEvent.setup();
    const response: SelectCeoResponse = {
      becameCeo: true,
      team: { id: 'team_1', ceoId: 'user_1' },
      user: mockUser({ role: 'CEO' }),
      state: mockState({ phase: 'DRAFTING' }),
    };
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: response } as never);

    renderChallenge(mockState());
    await user.click(screen.getByTestId('become-ceo-button'));
    await screen.findByTestId('result-success');

    expect(useAuthStore.getState().user?.role).toBe('CEO');
  });

  it('5. shows the CEO SELECTED state for a participant who clicked but lost the race', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('CEO_ALREADY_SELECTED'));

    renderChallenge(mockState());
    await user.click(screen.getByTestId('become-ceo-button'));

    expect(await screen.findByTestId('result-ceo-selected')).toBeInTheDocument();
    expect(screen.getByText('CEO SELECTED')).toBeInTheDocument();
  });

  it('6. shows CHALLENGE ENDED and disables further selection when the challenge has expired', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('CHALLENGE_EXPIRED'));

    renderChallenge(mockState());
    await user.click(screen.getByTestId('become-ceo-button'));

    expect(await screen.findByTestId('result-expired')).toBeInTheDocument();
    expect(screen.getByText('CHALLENGE ENDED')).toBeInTheDocument();
    expect(screen.queryByTestId('become-ceo-button')).not.toBeInTheDocument();
  });

  it('7. CEO dashboard (once a department is chosen) shows CEO name, hackathon phase, and the recruit-next-step prompt', () => {
    const ceoUser = mockUser({ role: 'CEO', slotDepartment: 'CCS' });
    const ceoMember = { id: 'user_1', fullName: 'Ada Lovelace', homeDepartment: 'CCS' as const, slotDepartment: 'CCS' as const, role: 'CEO' as const };
    renderCeoPage(
      mockTeam({ ceo: ceoMember, members: [ceoMember] }),
      ceoUser,
      mockState({ phase: 'DRAFTING', phaseLabel: 'TEAM_FORMATION' }),
    );

    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getByText('TEAM_FORMATION')).toBeInTheDocument();
    expect(screen.getByText(/NEXT STEP: Recruit the remaining four departments using QR/)).toBeInTheDocument();
  });

  it('8. a fresh render (simulating a refresh) restores CEO state purely from seeded server data', () => {
    // No mutation is called here at all — this simulates loading the CEO
    // dashboard fresh after a refresh, with /auth/me and /team/me already
    // having returned CEO/team data (department already assigned) before this
    // component ever mounts.
    const ceoUser = mockUser({ role: 'CEO', slotDepartment: 'CAF' });
    const ceoMember = { id: 'user_1', fullName: 'Ada Lovelace', homeDepartment: 'CCS' as const, slotDepartment: 'CAF' as const, role: 'CEO' as const };
    renderCeoPage(
      mockTeam({ ceo: ceoMember, members: [ceoMember], finalizedAt: null }),
      ceoUser,
      mockState({ phase: 'DRAFTING' }),
    );

    expect(screen.getAllByText('CEO').length).toBeGreaterThan(0);
    expect(screen.getByTestId('ceo-assigned-department')).toHaveTextContent('CAF');
  });

  it('9. reacts to a realtime state change without any user action (same mechanism the socket handler uses)', async () => {
    const queryClient = renderChallenge(mockState());
    expect(screen.getByTestId('become-ceo-button')).toBeInTheDocument();

    act(() => {
      queryClient.setQueryData(['hackathon-state'], mockState({ phase: 'DRAFTING', phaseLabel: 'TEAM_FORMATION' }));
    });

    expect(await screen.findByTestId('result-ceo-selected')).toBeInTheDocument();
  });
});
