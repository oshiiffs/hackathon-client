import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CeoDepartmentPage } from '../src/pages/ceo/CeoDepartmentPage';
import { CeoDashboardPage } from '../src/pages/ceo/CeoDashboardPage';
import { AppRoutes } from '../src/AppRoutes';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { HackathonStatePayload, PublicUser, Team, TeamMember } from '../src/types/api';

function mockUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'user_1',
    fullName: 'Ada Lovelace',
    email: null,
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'CEO',
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
    phase: 'DRAFTING',
    phaseLabel: 'TEAM_FORMATION',
    participantsLocked: true,
    currentChallengeRound: 1,
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

function ceoMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'user_1',
    fullName: 'Ada Lovelace',
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'CEO',
    ...overrides,
  };
}

function mockTeam(overrides: Partial<Team> = {}): Team {
  const ceo = overrides.ceo ?? ceoMember();
  return {
    id: 'team_1',
    name: null,
    ceoId: 'user_1',
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

function renderDepartmentPage(team: Team, user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['my-team'], team);
  queryClient.setQueryData(['hackathon-state'], mockState());
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ceo/department']}>
        <CeoDepartmentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

function renderDashboard(team: Team, user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['my-team'], team);
  queryClient.setQueryData(['hackathon-state'], mockState());
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ceo']}>
        <Routes>
          <Route path="/ceo" element={<CeoDashboardPage />} />
          <Route path="/ceo/department" element={<div data-testid="redirected-to-department" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('CEO department assignment (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. renders the CEO ASSIGNMENT page with the congratulations copy', () => {
    renderDepartmentPage(mockTeam());
    expect(screen.getByText('CEO ASSIGNMENT')).toBeInTheDocument();
    expect(screen.getByText('Congratulations! You are the CEO.')).toBeInTheDocument();
    expect(screen.getByText('Choose your department:')).toBeInTheDocument();
  });

  it('2. shows all five department buttons', () => {
    renderDepartmentPage(mockTeam());
    for (const dept of ['COE', 'CCS', 'CHS', 'CBM', 'CAF']) {
      expect(screen.getByTestId(`department-button-${dept}`)).toBeInTheDocument();
    }
  });

  it('3. lets the CEO select a department, sending exactly that department to the API', async () => {
    const user = userEvent.setup();
    const assignedTeam = mockTeam({ ceo: ceoMember({ slotDepartment: 'CHS' }), members: [ceoMember({ slotDepartment: 'CHS' })] });
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: assignedTeam } as never);

    renderDepartmentPage(mockTeam());
    await user.click(screen.getByTestId('department-button-CHS'));

    expect(postSpy).toHaveBeenCalledWith('/participant/ceo/department', { department: 'CHS' });
    expect(await screen.findByTestId('department-confirmed')).toBeInTheDocument();
  });

  it('4. disables the buttons while the request is in flight, preventing a duplicate submission', async () => {
    const user = userEvent.setup();
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockReturnValueOnce(pending as never);

    renderDepartmentPage(mockTeam());
    const button = screen.getByTestId('department-button-CAF');
    await user.click(button);
    await user.click(button);

    expect(button).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);

    resolveRequest({ data: mockTeam({ ceo: ceoMember({ slotDepartment: 'CAF' }), members: [ceoMember({ slotDepartment: 'CAF' })] }) });
  });

  it('5. shows the post-selection confirmation view with CEO name, department, and roster on success', async () => {
    const user = userEvent.setup();
    const assignedMember = ceoMember({ slotDepartment: 'COE' });
    const assignedTeam = mockTeam({ ceo: assignedMember, members: [assignedMember] });
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: assignedTeam } as never);

    renderDepartmentPage(mockTeam());
    await user.click(screen.getByTestId('department-button-COE'));

    expect(await screen.findByTestId('department-confirmed')).toBeInTheDocument();
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getByTestId('ceo-assigned-department')).toHaveTextContent('COE');
    expect(screen.getByTestId('member-count')).toHaveTextContent('1 / 5 MEMBERS');
  });

  it('6. redirects away from the department page once a department is already assigned (locked, no reassignment)', () => {
    const assignedMember = ceoMember({ slotDepartment: 'CBM' });
    renderDepartmentPage(mockTeam({ ceo: assignedMember, members: [assignedMember] }));

    expect(screen.queryByTestId('ceo-department-page')).not.toBeInTheDocument();
  });

  it('7. CEO dashboard shows the CEO’s assigned department', () => {
    const assignedMember = ceoMember({ slotDepartment: 'CHS' });
    renderDashboard(mockTeam({ ceo: assignedMember, members: [assignedMember] }));
    expect(screen.getByTestId('ceo-assigned-department')).toHaveTextContent('CHS');
  });

  it('8. team count shows 1 / 5 MEMBERS right after the CEO alone has joined', () => {
    const assignedMember = ceoMember({ slotDepartment: 'CCS' });
    renderDashboard(mockTeam({ ceo: assignedMember, members: [assignedMember] }));
    expect(screen.getByTestId('member-count')).toHaveTextContent('1 / 5 MEMBERS');
  });

  it('9. the other four departments remain shown as Available on the dashboard roster', () => {
    const assignedMember = ceoMember({ slotDepartment: 'CCS' });
    renderDashboard(mockTeam({ ceo: assignedMember, members: [assignedMember] }));
    expect(screen.getAllByText('Available')).toHaveLength(4);
  });

  it('10. a fresh render (simulating a refresh) restores the assignment purely from seeded server data, without calling the API again', () => {
    const postSpy = vi.spyOn(apiClient, 'post');
    const assignedMember = ceoMember({ slotDepartment: 'CAF' });
    renderDashboard(mockTeam({ ceo: assignedMember, members: [assignedMember] }));

    expect(screen.getByTestId('ceo-assigned-department')).toHaveTextContent('CAF');
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('11. a non-CEO role is blocked from /ceo/department with a 403, at the route level', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: mockUser({ role: 'PARTICIPANT' }), status: 'authenticated' });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ceo/department']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('403')).toBeInTheDocument();
  });
});
