import { describe, expect, it, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PresenterPage } from '../src/pages/admin/PresenterPage';
import { useAuthStore } from '../src/store/authStore';
import type { AdminHackathonStatePayload, PublicUser } from '../src/types/api';

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
    serverNow: new Date().toISOString(),
    connectedParticipants: 3,
    ...overrides,
  };
}

// Mirrors the real /admin/participants shape (see admin.service.ts's
// listParticipants) — the presenter's scanning screen reads straight off
// this, no separate/hardcoded roster.
function mockParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    fullName: 'Ada Lovelace',
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'PARTICIPANT',
    drafted: false,
    teamId: null,
    isCeoWinner: false,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Renders the presenter view and switches it to the "Scanning members"
 * screen — every test here cares about that screen specifically, not the
 * default auto/live one. */
async function renderScanningScreen(participants: ReturnType<typeof mockParticipant>[], adminState = mockAdminState()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['admin-hackathon-state'], adminState);
  queryClient.setQueryData(['admin-participants'], participants);
  queryClient.setQueryData(['admin-ceo-questions'], []);
  useAuthStore.setState({ user: mockAdmin(), status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/presenter']}>
        <PresenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByText('Scanning members'));
}

describe('Presenter — Scanning Members', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
  });

  it('1. shows each participant\'s name and status', async () => {
    await renderScanningScreen([mockParticipant({ id: 'p1', fullName: 'Ada Lovelace', drafted: false })]);

    expect(await screen.findByTestId('scanning-member-p1')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('2. a recruited (drafted) participant renders dimmed with a "Recruited" label', async () => {
    await renderScanningScreen([mockParticipant({ id: 'p2', fullName: 'Grace Hopper', drafted: true })]);

    const card = await screen.findByTestId('scanning-member-p2');
    expect(card.dataset.recruited).toBe('true');
    expect(card.className).toMatch(/grayscale/);
    expect(card.className).toMatch(/opacity-50/);
    expect(screen.getByText('Recruited')).toBeInTheDocument();
  });

  it('3. an available participant is NOT dimmed', async () => {
    await renderScanningScreen([mockParticipant({ id: 'p3', fullName: 'Katherine Johnson', drafted: false })]);

    const card = await screen.findByTestId('scanning-member-p3');
    expect(card.dataset.recruited).toBe('false');
    expect(card.className).not.toMatch(/grayscale/);
  });

  it('4. shows a live available/total count derived from the real recruitment data', async () => {
    await renderScanningScreen([
      mockParticipant({ id: 'p1', fullName: 'Ada Lovelace', drafted: false }),
      mockParticipant({ id: 'p2', fullName: 'Grace Hopper', drafted: true }),
      mockParticipant({ id: 'p3', fullName: 'Katherine Johnson', drafted: false }),
    ]);

    expect(await screen.findByTestId('scanning-members-count')).toHaveTextContent('2 / 3');
  });

  it('5. CEOs (already on a team) are excluded from the recruitable roster', async () => {
    await renderScanningScreen([
      mockParticipant({ id: 'p1', fullName: 'Ada Lovelace', role: 'PARTICIPANT', drafted: false }),
      mockParticipant({ id: 'ceo1', fullName: 'Radia Perlman', role: 'CEO', drafted: true }),
    ]);

    expect(await screen.findByTestId('scanning-member-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('scanning-member-ceo1')).not.toBeInTheDocument();
    expect(screen.getByTestId('scanning-members-count')).toHaveTextContent('1 / 1');
  });

  it('6. a participant without a photo avatar shows a department-colored initial badge instead', async () => {
    await renderScanningScreen([mockParticipant({ id: 'p1', fullName: 'Ada Lovelace', avatarUrl: null })]);

    const card = await screen.findByTestId('scanning-member-p1');
    expect(card.querySelector('img')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('A');
  });
});
