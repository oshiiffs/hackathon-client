import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { CeoFinalizePage } from '../src/pages/ceo/CeoFinalizePage';
import { CeoDashboardPage } from '../src/pages/ceo/CeoDashboardPage';
import { AppRoutes } from '../src/AppRoutes';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { CategoryUsage, Department, FinalizationStatus, PublicUser, Team, TeamMember } from '../src/types/api';

function mockUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'ceo_1',
    fullName: 'Grace Hopper',
    email: null,
    homeDepartment: 'CCS',
    slotDepartment: 'CCS',
    role: 'CEO',
    drafted: true,
    teamId: 'team_1',
    nickname: null,
    bio: null,
    skills: [],
    avatarUrl: null,
    ...overrides,
  };
}

function ceoMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return { id: 'ceo_1', fullName: 'Grace Hopper', homeDepartment: 'CCS', slotDepartment: 'CCS', role: 'CEO', ...overrides };
}

function fullRoster(): TeamMember[] {
  return [
    ceoMember(),
    { id: 'm2', fullName: 'Member COE', homeDepartment: 'COE', slotDepartment: 'COE', role: 'PARTICIPANT' },
    { id: 'm3', fullName: 'Member CHS', homeDepartment: 'CHS', slotDepartment: 'CHS', role: 'PARTICIPANT' },
    { id: 'm4', fullName: 'Member CBM', homeDepartment: 'CBM', slotDepartment: 'CBM', role: 'PARTICIPANT' },
    { id: 'm5', fullName: 'Member CAF', homeDepartment: 'CAF', slotDepartment: 'CAF', role: 'PARTICIPANT' },
  ];
}

function mockTeam(overrides: Partial<Team> = {}): Team {
  const ceo = overrides.ceo ?? ceoMember();
  return {
    id: 'team_1',
    name: null,
    ceoId: ceo.id,
    ceo,
    members: overrides.members ?? [ceo],
    category: null,
    isComplete: false,
    finalizedAt: null,
    deliverable: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockCategories(overrides: Partial<Record<string, Partial<CategoryUsage>>> = {}): CategoryUsage[] {
  const base: CategoryUsage[] = [
    { category: 'HEALTH', used: 1, capacity: 3, available: 2, full: false, teams: [] },
    { category: 'ENVIRONMENT', used: 2, capacity: 3, available: 1, full: false, teams: [] },
    { category: 'AGRICULTURE', used: 3, capacity: 3, available: 0, full: true, teams: [] },
    { category: 'TOURISM', used: 0, capacity: 3, available: 3, full: false, teams: [] },
  ];
  return base.map((c) => ({ ...c, ...overrides[c.category] }));
}

function mockStatus(overrides: Partial<FinalizationStatus> = {}): FinalizationStatus {
  const departmentComplete = {} as Record<Department, boolean>;
  for (const d of ['COE', 'CCS', 'CHS', 'CBM', 'CAF'] as Department[]) departmentComplete[d] = true;
  return {
    team: mockTeam({ members: fullRoster(), isComplete: true }),
    memberCount: 5,
    departmentComplete,
    canFinalize: true,
    reason: null,
    categories: mockCategories(),
    allowIncompleteTeams: false,
    ...overrides,
  };
}

function axiosErrorWithCode(code: string) {
  return new AxiosError(
    'Request failed',
    '409',
    { headers: new AxiosHeaders(), method: 'post', url: '/participant/ceo/finalize' },
    {},
    { status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: 'nope' } } },
  );
}

function renderFinalizePage(status: FinalizationStatus = mockStatus(), user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['finalization-status'], status);
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ceo/team/finalize']}>
        <Routes>
          <Route path="/ceo/team/finalize" element={<CeoFinalizePage />} />
          <Route path="/team" element={<div data-testid="team-hub-landing" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('Team finalization (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. requires 5/5 members before finalization is allowed', () => {
    renderFinalizePage(
      mockStatus({
        memberCount: 4,
        canFinalize: false,
        reason: 'TEAM_NOT_COMPLETE',
        team: mockTeam({ members: fullRoster().slice(0, 4) }),
      }),
    );
    expect(screen.getByTestId('finalize-not-ready')).toBeInTheDocument();
    expect(screen.getByTestId('finalize-team-button')).toBeDisabled();
  });

  it('2. all five departments are displayed with their completion state', () => {
    renderFinalizePage();
    for (const dept of ['COE', 'CCS', 'CHS', 'CBM', 'CAF']) {
      expect(screen.getByText(new RegExp(dept))).toBeInTheDocument();
    }
  });

  it('3. the team name input accepts typed text', async () => {
    const user = userEvent.setup();
    renderFinalizePage();
    const input = screen.getByTestId('team-name-input') as HTMLInputElement;
    await user.type(input, 'Jade Innovators');
    expect(input.value).toBe('Jade Innovators');
  });

  it('4. HEAT capacities render for all four categories', () => {
    renderFinalizePage();
    expect(screen.getByTestId('category-button-HEALTH')).toHaveTextContent('1 / 3');
    expect(screen.getByTestId('category-button-ENVIRONMENT')).toHaveTextContent('2 / 3');
    expect(screen.getByTestId('category-button-AGRICULTURE')).toHaveTextContent('3 / 3');
    expect(screen.getByTestId('category-button-TOURISM')).toHaveTextContent('0 / 3');
  });

  it('5. a full category button is disabled', () => {
    renderFinalizePage();
    expect(screen.getByTestId('category-button-AGRICULTURE')).toBeDisabled();
    expect(screen.getByTestId('category-button-HEALTH')).not.toBeDisabled();
  });

  it('6. clicking FINALIZE TEAM opens the confirmation dialog with the exact copy', async () => {
    const user = userEvent.setup();
    renderFinalizePage();
    await user.type(screen.getByTestId('team-name-input'), 'Jade Innovators');
    await user.click(screen.getByTestId('category-button-TOURISM'));
    await user.click(screen.getByTestId('finalize-team-button'));

    const dialog = await screen.findByTestId('finalize-confirm-dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('FINALIZE TEAM?')).toBeInTheDocument();
    expect(within(dialog).getByText('Jade Innovators')).toBeInTheDocument();
    expect(within(dialog).getByText('TOURISM')).toBeInTheDocument();
    expect(within(dialog).getByText('Once finalized, normal recruitment will be closed.')).toBeInTheDocument();
  });

  it('7. CANCEL closes the dialog without finalizing', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post');
    renderFinalizePage();
    await user.type(screen.getByTestId('team-name-input'), 'Jade Innovators');
    await user.click(screen.getByTestId('category-button-TOURISM'));
    await user.click(screen.getByTestId('finalize-team-button'));
    await screen.findByTestId('finalize-confirm-dialog');

    await user.click(screen.getByTestId('cancel-finalize-button'));

    expect(screen.queryByTestId('finalize-confirm-dialog')).not.toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('8. a successful finalization shows the TEAM FINALIZED success state', async () => {
    const user = userEvent.setup();
    const finalized = mockTeam({ name: 'Jade Innovators', category: 'TOURISM', finalizedAt: new Date().toISOString(), members: fullRoster(), isComplete: true });
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: finalized } as never);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockStatus({ team: finalized }) } as never);

    renderFinalizePage();
    await user.type(screen.getByTestId('team-name-input'), 'Jade Innovators');
    await user.click(screen.getByTestId('category-button-TOURISM'));
    await user.click(screen.getByTestId('finalize-team-button'));
    await screen.findByTestId('finalize-confirm-dialog');
    await user.click(screen.getByTestId('confirm-finalize-button'));

    expect(await screen.findByTestId('finalize-success')).toBeInTheDocument();
    expect(screen.getByText('TEAM FINALIZED')).toBeInTheDocument();
    expect(screen.getByText('Jade Innovators')).toBeInTheDocument();
    expect(screen.getByText('TOURISM')).toBeInTheDocument();
  });

  it('9. a TEAM_NAME_TAKEN rejection is displayed', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('TEAM_NAME_TAKEN'));

    renderFinalizePage();
    await user.type(screen.getByTestId('team-name-input'), 'Jade Innovators');
    await user.click(screen.getByTestId('category-button-TOURISM'));
    await user.click(screen.getByTestId('finalize-team-button'));
    await screen.findByTestId('finalize-confirm-dialog');
    await user.click(screen.getByTestId('confirm-finalize-button'));

    expect(await screen.findByTestId('finalize-error')).toHaveTextContent('TEAM_NAME_TAKEN');
  });

  it('10. a CATEGORY_FULL rejection is displayed', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('CATEGORY_FULL'));

    renderFinalizePage();
    await user.type(screen.getByTestId('team-name-input'), 'Jade Innovators');
    await user.click(screen.getByTestId('category-button-TOURISM'));
    await user.click(screen.getByTestId('finalize-team-button'));
    await screen.findByTestId('finalize-confirm-dialog');
    await user.click(screen.getByTestId('confirm-finalize-button'));

    expect(await screen.findByTestId('finalize-error')).toHaveTextContent('CATEGORY_FULL');
  });

  it('11. a realtime capacity update (the same mechanism the socket handler uses) is reflected live', async () => {
    const queryClient = renderFinalizePage();
    expect(screen.getByTestId('category-button-TOURISM')).toHaveTextContent('0 / 3');

    act(() => {
      queryClient.setQueryData(['finalization-status'], mockStatus({ categories: mockCategories({ TOURISM: { used: 3, available: 0, full: true } }) }));
    });

    expect(await screen.findByTestId('category-button-TOURISM')).toHaveTextContent('3 / 3');
    expect(screen.getByTestId('category-button-TOURISM')).toBeDisabled();
  });

  it('12. a complete-but-not-finalized team dashboard links to the finalization page', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
    queryClient.setQueryData(['my-team'], mockTeam({ members: fullRoster(), isComplete: true }));
    useAuthStore.setState({ user: mockUser(), status: 'authenticated' });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ceo']}>
          <CeoDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const link = screen.getByText('FINALIZE TEAM').closest('a');
    expect(link).toHaveAttribute('href', '/ceo/team/finalize');
  });

  it('13. after a successful finalization, "OPEN TEAM HUB" navigates to the Team Hub', async () => {
    const user = userEvent.setup();
    const finalized = mockTeam({ name: 'Jade Innovators', category: 'TOURISM', finalizedAt: new Date().toISOString(), members: fullRoster(), isComplete: true });
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: finalized } as never);
    // A successful finalize invalidates ['finalization-status'], which
    // triggers a real background refetch — give it a controlled response.
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockStatus({ team: finalized }) } as never);

    renderFinalizePage();
    await user.type(screen.getByTestId('team-name-input'), 'Jade Innovators');
    await user.click(screen.getByTestId('category-button-TOURISM'));
    await user.click(screen.getByTestId('finalize-team-button'));
    await screen.findByTestId('finalize-confirm-dialog');
    await user.click(screen.getByTestId('confirm-finalize-button'));
    await screen.findByTestId('finalize-success');

    await user.click(screen.getByText('OPEN TEAM HUB'));
    expect(await screen.findByTestId('team-hub-landing')).toBeInTheDocument();
  });

  it('14. a normal participant cannot reach the CEO finalization page (403)', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: mockUser({ role: 'PARTICIPANT' }), status: 'authenticated' });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ceo/team/finalize']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('403')).toBeInTheDocument();
  });

  it('15. a fresh render (simulating a refresh) restores the finalized state directly from seeded server data', () => {
    renderFinalizePage(mockStatus({ team: mockTeam({ name: 'Jade Innovators', category: 'TOURISM', finalizedAt: new Date().toISOString(), members: fullRoster(), isComplete: true }) }));
    expect(screen.getByTestId('finalize-success')).toBeInTheDocument();
    expect(screen.getByText('Jade Innovators')).toBeInTheDocument();
  });
});
