import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { TeamHubPage } from '../src/pages/team/TeamHubPage';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { PublicUser, TeamOverview } from '../src/types/api';

function mockUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'p1',
    fullName: 'Juan Dela Cruz',
    email: null,
    homeDepartment: 'COE',
    slotDepartment: 'COE',
    role: 'PARTICIPANT',
    drafted: true,
    teamId: 'team_1',
    nickname: null,
    bio: null,
    skills: [],
    avatarUrl: null,
    ...overrides,
  };
}

function mockOverview(overrides: Partial<TeamOverview> = {}): TeamOverview {
  return {
    team: {
      id: 'team_1',
      name: 'Jade Innovators',
      category: 'AGRICULTURE',
      status: 'FINALIZED',
      finalizedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      memberCount: 5,
      maxMembers: 5,
    },
    ceo: { id: 'ceo_1', name: 'Grace Hopper' },
    members: [
      { id: 'p1', name: 'Juan Dela Cruz', department: 'COE', isCeo: false },
      { id: 'ceo_1', name: 'Grace Hopper', department: 'CCS', isCeo: true },
      { id: 'p3', name: 'Maria Santos', department: 'CHS', isCeo: false },
      { id: 'p4', name: 'John Reyes', department: 'CBM', isCeo: false },
      { id: 'p5', name: 'Ana Cruz', department: 'CAF', isCeo: false },
    ],
    project: {
      title: 'AgriSense',
      description: 'A crop-health monitoring platform.',
      problemStatement: 'Farmers lack early warning of crop stress.',
      proposedSolution: 'Low-cost sensor + ML alerts.',
      targetUsers: 'Smallholder farmers',
      technologyStack: 'React, Fastify, Postgres',
    },
    submission: { status: 'IN_PROGRESS' },
    deliverables: {
      pitchDeck: { status: 'NOT_UPLOADED', version: null, lastUpdated: null },
      documentation: { status: 'NOT_UPLOADED' },
      other: { status: 'NOT_UPLOADED' },
    },
    ...overrides,
  };
}

function axiosErrorWithCode(code: string, status = 403) {
  return new AxiosError(
    'Request failed',
    String(status),
    { headers: new AxiosHeaders(), method: 'get', url: '/team/overview' },
    {},
    { status, statusText: 'Error', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: 'nope' } } },
  );
}

function renderTeamHub(overview: TeamOverview | undefined, user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  if (overview) queryClient.setQueryData(['team-overview'], overview);
  // The new file-management section fetches its own data (separate from the
  // overview) — seed empty defaults so these tests, which aren't exercising
  // file management, don't trigger a real (failing) network call.
  queryClient.setQueryData(['pitch-deck'], { current: null, previousVersions: [] });
  queryClient.setQueryData(['team-files'], []);
  queryClient.setQueryData(['ai-sessions'], []);
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/team/overview']}>
        <TeamHubPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('Team Hub (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. the Team Hub renders for a finalized team', () => {
    renderTeamHub(mockOverview());
    expect(screen.getByTestId('team-hub')).toBeInTheDocument();
  });

  it('2. the team name displays', () => {
    renderTeamHub(mockOverview());
    expect(screen.getAllByText('Jade Innovators').length).toBeGreaterThan(0);
  });

  it('3. the HEAT category displays', () => {
    renderTeamHub(mockOverview());
    expect(screen.getByTestId('team-heat-category')).toHaveTextContent('AGRICULTURE');
  });

  it('4. the CEO displays', () => {
    renderTeamHub(mockOverview());
    expect(screen.getAllByText(/Grace Hopper/).length).toBeGreaterThan(0);
  });

  it('5. the five-member roster displays', () => {
    renderTeamHub(mockOverview());
    for (const name of ['Juan Dela Cruz', 'Grace Hopper', 'Maria Santos', 'John Reyes', 'Ana Cruz']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId('member-count')).toHaveTextContent('5 / 5 MEMBERS');
  });

  it('6. department badges display for all five departments', () => {
    renderTeamHub(mockOverview());
    for (const dept of ['COE', 'CCS', 'CHS', 'CBM', 'CAF']) {
      expect(screen.getAllByText(dept).length).toBeGreaterThan(0);
    }
  });

  it('7. the CEO badge (👑) displays on the CEO\'s roster slot', () => {
    renderTeamHub(mockOverview());
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('8. project fields render with existing values', () => {
    renderTeamHub(mockOverview());
    expect(screen.getByTestId('project-field-title')).toHaveValue('AgriSense');
    expect(screen.getByTestId('project-field-technologyStack')).toHaveValue('React, Fastify, Postgres');
  });

  it('9. saving the project form works', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      data: { ...mockOverview().project, title: 'AgriSense 2.0' },
    } as never);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockOverview() } as never);

    renderTeamHub(mockOverview());
    const titleInput = screen.getByTestId('project-field-title');
    await user.clear(titleInput);
    await user.type(titleInput, 'AgriSense 2.0');
    await user.click(screen.getByTestId('save-project-button'));

    expect(await screen.findByTestId('save-project-success')).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledWith('/team/project', expect.objectContaining({ title: 'AgriSense 2.0' }));
  });

  it('10. shows a loading state while the overview is being fetched', () => {
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    vi.spyOn(apiClient, 'get').mockReturnValueOnce(pending as never);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: mockUser(), status: 'authenticated' });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/team/overview']}>
          <TeamHubPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Loading your team…')).toBeInTheDocument();
    resolveRequest({ data: mockOverview() });
  });

  it('11. shows a generic error state for a non-access-control failure', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('network down'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: mockUser(), status: 'authenticated' });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/team/overview']}>
          <TeamHubPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('12. shows the access-denied ("not on a team") state for TEAM_ACCESS_DENIED', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(axiosErrorWithCode('TEAM_ACCESS_DENIED'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: mockUser(), status: 'authenticated' });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/team/overview']}>
          <TeamHubPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('no-team-state')).toBeInTheDocument();
    expect(screen.getByText("You're not on a team yet")).toBeInTheDocument();
  });

  it('13. shows the recruited (pre-finalization) state even for a partially-formed team', () => {
    const overview = mockOverview({
      team: { ...mockOverview().team, status: 'FORMING', finalizedAt: null, category: null, name: null, memberCount: 2 },
      members: [
        { id: 'p1', name: 'Juan Dela Cruz', department: 'COE', isCeo: false },
        { id: 'ceo_1', name: 'Grace Hopper', department: 'CCS', isCeo: true },
      ],
    });
    renderTeamHub(overview);
    expect(screen.getByTestId('recruited-screen')).toBeInTheDocument();
    expect(screen.getByText('YOU HAVE BEEN RECRUITED')).toBeInTheDocument();
  });

  it('14. shows the full finalized Team Hub state', () => {
    renderTeamHub(mockOverview());
    expect(screen.getByText('TEAM FINALIZED')).toBeInTheDocument();
    expect(screen.getByTestId('project-section')).toBeInTheDocument();
    expect(screen.getByTestId('project-status-section')).toBeInTheDocument();
    expect(screen.getByTestId('deliverables-section')).toBeInTheDocument();
  });

  it('15. a realtime team-state change (the same mechanism the socket handler uses) refreshes the UI', async () => {
    const queryClient = renderTeamHub(mockOverview());
    expect(screen.getAllByText('Jade Innovators').length).toBeGreaterThan(0);

    act(() => {
      queryClient.setQueryData(['team-overview'], mockOverview({ team: { ...mockOverview().team, name: 'Renamed Team' } }));
    });

    expect((await screen.findAllByText('Renamed Team')).length).toBeGreaterThan(0);
  });

  it('16. a reconnect-triggered refetch restores authoritative state', async () => {
    const queryClient = renderTeamHub(mockOverview());
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: mockOverview({ team: { ...mockOverview().team, name: 'Restored After Reconnect' } }),
    } as never);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-overview'] });
    });

    expect((await screen.findAllByText('Restored After Reconnect')).length).toBeGreaterThan(0);
  });

  it('17. the pitch deck section reports "Not uploaded" when no deck exists yet (Phase 10: real, DB-derived state)', () => {
    renderTeamHub(mockOverview());
    expect(screen.getByTestId('deliverables-section')).toBeInTheDocument();
    expect(screen.getByTestId('pitch-deck-status')).toHaveTextContent('Not uploaded');
  });

  it('18. the pitch deck upload control is enabled — Phase 10 replaced the Phase 9 placeholder with real uploads', () => {
    renderTeamHub(mockOverview());
    const button = screen.getByTestId('pitch-deck-upload-button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Upload Pitch Deck');
  });

  it('19. the roster grid uses responsive column classes (mobile-first, expanding on larger screens)', () => {
    renderTeamHub(mockOverview());
    const rosterSection = screen.getByTestId('team-roster-section');
    const grid = rosterSection.querySelector('.grid');
    expect(grid?.className).toMatch(/grid-cols-1/);
    expect(grid?.className).toMatch(/sm:grid-cols-5/);
  });

  it('20. a user with no team association is denied without leaking any team\'s data', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(axiosErrorWithCode('TEAM_ACCESS_DENIED'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: mockUser({ teamId: null, drafted: false }), status: 'authenticated' });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/team/overview']}>
          <TeamHubPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('no-team-state')).toBeInTheDocument();
    expect(screen.queryByTestId('team-hub')).not.toBeInTheDocument();
    expect(screen.queryByText('Jade Innovators')).not.toBeInTheDocument();
  });
});
