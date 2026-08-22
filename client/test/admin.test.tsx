import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminDashboardPage } from '../src/pages/admin/AdminDashboardPage';
import { useAuthStore } from '../src/store/authStore';
import type { AdminHackathonStatePayload, AdminOverview, PublicUser } from '../src/types/api';

function mockAdmin(): PublicUser {
  return {
    id: 'admin_1',
    fullName: 'Event Admin',
    email: 'admin@hackathon.local',
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'ADMIN',
    drafted: false,
    teamId: null,
  };
}

function mockAdminState(overrides: Partial<AdminHackathonStatePayload> = {}): AdminHackathonStatePayload {
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
    connectedParticipants: 7,
    ...overrides,
  };
}

function mockOverview(overrides: Partial<AdminOverview> = {}): AdminOverview {
  return {
    totalParticipants: 40,
    draftedParticipants: 12,
    undraftedParticipants: 28,
    totalTeams: 2,
    completeTeams: 1,
    finalizedTeams: 0,
    ceoCount: 2,
    categoryUsage: [
      { category: 'HEALTH', used: 1, capacity: 3, available: 2, full: false, teams: [] },
      { category: 'ENVIRONMENT', used: 0, capacity: 3, available: 3, full: false, teams: [] },
      { category: 'AGRICULTURE', used: 0, capacity: 3, available: 3, full: false, teams: [] },
      { category: 'TOURISM', used: 0, capacity: 3, available: 3, full: false, teams: [] },
    ],
    ...overrides,
  };
}

function renderAdmin(adminState: AdminHackathonStatePayload) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['admin-hackathon-state'], adminState);
  queryClient.setQueryData(['admin-overview'], mockOverview());
  queryClient.setQueryData(['admin-teams'], []);
  queryClient.setQueryData(['admin-participants'], []);
  useAuthStore.setState({ user: mockAdmin(), status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Admin dashboard — control center', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
  });

  it('renders live state from the backend, not hardcoded numbers', () => {
    renderAdmin(mockAdminState({ phaseLabel: 'WAITING', connectedParticipants: 7 }));
    expect(screen.getByText('WAITING')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument(); // connected count
    expect(screen.getByText('12/40')).toBeInTheDocument(); // drafted/total participants
  });

  it('lets the admin trigger a confirmable control action (start CEO challenge)', async () => {
    const user = userEvent.setup();
    renderAdmin(mockAdminState({ phase: 'LOBBY' })); // valid state to start a challenge from
    await user.click(screen.getByRole('button', { name: 'Start CEO challenge' }));
    expect(await screen.findByText('Start the CEO challenge?')).toBeInTheDocument();
  });

  it('disables actions that are invalid for the current phase (invalid-transition UI)', () => {
    renderAdmin(mockAdminState({ phase: 'CEO_CHALLENGE_ACTIVE' })); // already active
    expect(screen.getByRole('button', { name: 'Start CEO challenge' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop CEO challenge' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open submissions' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mark event complete' })).toBeDisabled();
  });
});
