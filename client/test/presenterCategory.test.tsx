import { describe, expect, it, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PresenterPage } from '../src/pages/admin/PresenterPage';
import { useAuthStore } from '../src/store/authStore';
import type { AdminHackathonStatePayload, AdminOverview, CategoryUsage, PublicUser } from '../src/types/api';

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
    phase: 'DRAFTING',
    phaseLabel: 'TEAM_FORMATION',
    participantsLocked: false,
    currentChallengeRound: 1,
    ceoSlotsForCurrentRound: 0,
    challengeDurationSeconds: 30,
    challengeStartedAt: null,
    challengeEndsAt: null,
    submissionsLocked: false,
    allowIncompleteTeams: false,
    ceoNameSelectionSeconds: 60,
    heatCategorySelectionSeconds: 30,
    serverNow: new Date().toISOString(),
    connectedParticipants: 3,
    ...overrides,
  };
}

function mockCategoryUsage(overrides: Partial<Record<string, Partial<CategoryUsage>>> = {}): CategoryUsage[] {
  const base: CategoryUsage[] = [
    { category: 'HEALTH', used: 0, capacity: 3, available: 3, full: false, teams: [] },
    { category: 'ENVIRONMENT', used: 0, capacity: 3, available: 3, full: false, teams: [] },
    { category: 'AGRICULTURE', used: 0, capacity: 3, available: 3, full: false, teams: [] },
    { category: 'TOURISM', used: 0, capacity: 3, available: 3, full: false, teams: [] },
  ];
  return base.map((c) => ({ ...c, ...overrides[c.category] }));
}

function mockOverview(categoryUsage: CategoryUsage[]): AdminOverview {
  return {
    totalParticipants: 40,
    draftedParticipants: 12,
    undraftedParticipants: 28,
    eligibleCeoParticipants: 10,
    activeCeoQuestionCount: 10,
    ceoQuestionsReady: true,
    totalTeams: 2,
    completeTeams: 1,
    finalizedTeams: 1,
    ceoCount: 2,
    categoryUsage,
  };
}

async function renderCategoryScreen(categoryUsage: CategoryUsage[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['admin-hackathon-state'], mockAdminState());
  queryClient.setQueryData(['admin-participants'], []);
  queryClient.setQueryData(['admin-ceo-questions'], []);
  queryClient.setQueryData(['admin-overview'], mockOverview(categoryUsage));
  useAuthStore.setState({ user: mockAdmin(), status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/presenter']}>
        <PresenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByText('Category selection'));
}

describe('Presenter — Category Selection', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
  });

  it('1. shows all four category panels with their icons', async () => {
    await renderCategoryScreen(mockCategoryUsage());

    for (const category of ['HEALTH', 'ENVIRONMENT', 'AGRICULTURE', 'TOURISM']) {
      expect(await screen.findByTestId(`presenter-category-panel-${category}`)).toBeInTheDocument();
      expect(screen.getByTestId(`presenter-category-icon-${category}`)).toBeInTheDocument();
    }
  });

  it('2. a category with a finalized team shows that team\'s name', async () => {
    await renderCategoryScreen(mockCategoryUsage({ HEALTH: { teams: [{ id: 't1', name: 'Manok.js' }] } }));

    expect(await screen.findByTestId('presenter-category-team-HEALTH')).toHaveTextContent('Manok.js');
  });

  it('3. an empty category shows no placeholder team name', async () => {
    await renderCategoryScreen(mockCategoryUsage());

    expect(await screen.findByTestId('presenter-category-panel-TOURISM')).toBeInTheDocument();
    expect(screen.queryByTestId('presenter-category-team-TOURISM')).not.toBeInTheDocument();
  });

  it('4. a category with multiple finalized teams shows each team name', async () => {
    await renderCategoryScreen(
      mockCategoryUsage({
        AGRICULTURE: {
          teams: [
            { id: 't1', name: 'Manok.js' },
            { id: 't2', name: 'Byte Bandits' },
          ],
        },
      }),
    );

    const teamBadges = await screen.findAllByTestId('presenter-category-team-AGRICULTURE');
    expect(teamBadges.map((el) => el.textContent)).toEqual(['Manok.js', 'Byte Bandits']);
  });

  it('5. the "Category selection" nav tab is visually active on this screen', async () => {
    await renderCategoryScreen(mockCategoryUsage());

    expect(screen.getByText('Category selection').className).toMatch(/bg-crimson/);
  });
});
