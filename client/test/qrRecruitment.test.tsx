import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { CeoRecruitPage } from '../src/pages/ceo/CeoRecruitPage';
import { TeamHubPage } from '../src/pages/team/TeamHubPage';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { PublicUser, QrScanResult, RecruitResult, Team, TeamMember, TeamOverview } from '../src/types/api';

vi.mock('../src/components/QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (text: string) => void }) => (
    <div data-testid="mock-scanner">
      <button data-testid="mock-scan-trigger" onClick={() => onScan('HACKATHON-PARTICIPANT:mock-token')}>
        simulate scan
      </button>
    </div>
  ),
}));


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
    ...overrides,
  };
}

function ceoMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return { id: 'ceo_1', fullName: 'Grace Hopper', homeDepartment: 'CCS', slotDepartment: 'CCS', role: 'CEO', ...overrides };
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

function axiosErrorWithCode(code: string, url = '/participant/ceo/recruit') {
  return new AxiosError(
    'Request failed',
    '409',
    { headers: new AxiosHeaders(), method: 'post', url },
    {},
    { status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: 'nope' } } },
  );
}

function scanResult(overrides: Partial<QrScanResult['participant']> = {}): QrScanResult {
  return {
    valid: true,
    participant: { id: 'p1', name: 'Juan Dela Cruz', department: 'COE', ...overrides },
    recruitment: { currentlyDrafted: false, departmentAvailable: true },
  };
}

function recruitResult(memberCount: number, department: QrScanResult['participant']['department'] = 'COE'): RecruitResult {
  return {
    success: true,
    member: { id: 'p1', name: 'Juan Dela Cruz', department },
    team: {
      id: 'team_1',
      memberCount,
      maxMembers: 5,
      departments: {
        COE: department === 'COE' ? 'FILLED' : 'AVAILABLE',
        CCS: 'CEO',
        CHS: 'AVAILABLE',
        CBM: 'AVAILABLE',
        CAF: 'AVAILABLE',
      },
    },
  };
}

function renderRecruitPage(team: Team = mockTeam(), user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['my-team'], team);
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ceo/recruit']}>
        <Routes>
          <Route path="/ceo/recruit" element={<CeoRecruitPage />} />
          <Route path="/ceo/department" element={<div data-testid="redirected-to-department" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

function renderTeamHub(team: Team, user: PublicUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  const overview: TeamOverview = {
    team: {
      id: team.id,
      name: team.name,
      category: team.category,
      status: team.finalizedAt ? 'FINALIZED' : team.isComplete ? 'COMPLETE' : 'FORMING',
      finalizedAt: team.finalizedAt,
      createdAt: team.createdAt,
      memberCount: team.members.length,
      maxMembers: 5,
    },
    ceo: { id: team.ceoId, name: team.ceo.fullName },
    members: team.members.map((m) => ({ id: m.id, name: m.fullName, department: m.slotDepartment, isCeo: m.id === team.ceoId })),
    project: { title: null, description: null, problemStatement: null, proposedSolution: null, targetUsers: null, technologyStack: null },
    submission: { status: 'DRAFT' },
    deliverables: {
      pitchDeck: { status: 'NOT_UPLOADED', version: null, lastUpdated: null },
      documentation: { status: 'NOT_UPLOADED' },
      other: { status: 'NOT_UPLOADED' },
    },
  };
  queryClient.setQueryData(['team-overview'], overview);
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/team']}>
        <TeamHubPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function scanThenOpenConfirm(user: ReturnType<typeof userEvent.setup>, scanResponse: QrScanResult = scanResult()) {
  vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: scanResponse } as never);
  await user.click(screen.getByTestId('mock-scan-trigger'));
  await screen.findByTestId('scan-result-found');
  await user.click(screen.getByTestId('continue-to-recruit-button'));
  await screen.findByTestId('recruit-confirm-dialog');
}

describe('Atomic QR recruitment (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. a successful scan displays the MEMBER FOUND result', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: scanResult() } as never);

    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));

    expect(await screen.findByTestId('scan-result-found')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('2. clicking RECRUIT MEMBER opens the recruit confirmation dialog with the exact copy', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);

    expect(screen.getByText('Recruit Juan Dela Cruz as COE?')).toBeInTheDocument();
    expect(screen.getByText('This will permanently add them to your team.')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-recruit-button')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-recruit-button')).toBeInTheDocument();
  });

  it('3. CANCEL closes the dialog without recruiting', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post');
    postSpy.mockResolvedValueOnce({ data: scanResult() } as never);
    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));
    await screen.findByTestId('scan-result-found');
    await user.click(screen.getByTestId('continue-to-recruit-button'));
    await screen.findByTestId('recruit-confirm-dialog');

    await user.click(screen.getByTestId('cancel-recruit-button'));

    expect(screen.queryByTestId('recruit-confirm-dialog')).not.toBeInTheDocument();
    expect(await screen.findByTestId('scan-result-found')).toBeInTheDocument();
    // Only the scan-qr call happened — never /participant/ceo/recruit.
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).not.toHaveBeenCalledWith('/participant/ceo/recruit', expect.anything());
  });

  it('4. confirming RECRUIT shows a loading state', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);

    let resolveRecruit!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRecruit = resolve;
    });
    vi.spyOn(apiClient, 'post').mockReturnValueOnce(pending as never);

    await user.click(screen.getByTestId('confirm-recruit-button'));

    expect(screen.getByTestId('recruiting-loading')).toBeInTheDocument();
    resolveRecruit({ data: recruitResult(2) });
  });

  it('5. a duplicate click on RECRUIT while pending is prevented (exactly one POST)', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);

    let resolveRecruit!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRecruit = resolve;
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockReturnValueOnce(pending as never);

    await user.click(screen.getByTestId('confirm-recruit-button'));
    // The dialog is gone once we're in the "recruiting" state, so a second
    // click can't reach the confirm button again — nothing left to double-click.
    expect(screen.queryByTestId('confirm-recruit-button')).not.toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledTimes(1);

    resolveRecruit({ data: recruitResult(2) });
  });

  it('6. a successful recruitment shows MEMBER RECRUITED and invalidates the roster', async () => {
    const user = userEvent.setup();
    const qc = renderRecruitPage();
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: recruitResult(2) } as never);
    // A successful recruit invalidates ['my-team'], which triggers a real
    // background refetch — give it a controlled response instead of letting
    // it hit the network.
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockTeam({ members: [ceoMember(), { ...ceoMember(), id: 'p1', fullName: 'Juan Dela Cruz', slotDepartment: 'COE', role: 'PARTICIPANT' }] }) } as never);
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    await user.click(screen.getByTestId('confirm-recruit-button'));
    await screen.findByTestId('scan-result-recruited');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my-team'] });

    expect(screen.getByText('MEMBER RECRUITED')).toBeInTheDocument();
  });

  it('7. the member-count transition (e.g. 1 / 5 → 2 / 5) is shown after a successful recruit', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: recruitResult(2) } as never);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockTeam({ members: [ceoMember(), { ...ceoMember(), id: 'p1', fullName: 'Juan Dela Cruz', slotDepartment: 'COE', role: 'PARTICIPANT' }] }) } as never);

    await user.click(screen.getByTestId('confirm-recruit-button'));
    await screen.findByTestId('scan-result-recruited');

    expect(screen.getByTestId('member-count-transition')).toHaveTextContent('Team: 1 / 5 → 2 / 5');
  });

  it('8. the recruited department is reflected as FILLED in the response', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: recruitResult(2, 'COE') } as never);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockTeam({ members: [ceoMember(), { ...ceoMember(), id: 'p1', fullName: 'Juan Dela Cruz', slotDepartment: 'COE', role: 'PARTICIPANT' }] }) } as never);

    await user.click(screen.getByTestId('confirm-recruit-button'));
    await screen.findByTestId('scan-result-recruited');

    expect(screen.getByText('COE')).toBeInTheDocument();
  });

  it('9. a recruited (but not-yet-finalized) participant sees "YOU HAVE BEEN RECRUITED"', () => {
    const ceo = ceoMember();
    const me: TeamMember = { id: 'p1', fullName: 'Juan Dela Cruz', homeDepartment: 'COE', slotDepartment: 'COE', role: 'PARTICIPANT' };
    const team = mockTeam({ members: [ceo, me] });
    const user = mockUser({ id: 'p1', fullName: 'Juan Dela Cruz', role: 'PARTICIPANT', drafted: true, teamId: team.id, homeDepartment: 'COE', slotDepartment: 'COE' });

    renderTeamHub(team, user);

    expect(screen.getByTestId('recruited-screen')).toBeInTheDocument();
    expect(screen.getByText('YOU HAVE BEEN RECRUITED')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByTestId('recruited-waiting-indicator')).toBeInTheDocument();
  });

  it('10. an already-drafted error displays after confirming recruit', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('PARTICIPANT_ALREADY_DRAFTED'));

    await user.click(screen.getByTestId('confirm-recruit-button'));

    expect(await screen.findByText('NOT AVAILABLE')).toBeInTheDocument();
  });

  it('11. a department-unavailable error displays after confirming recruit', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('DEPARTMENT_SLOT_TAKEN'));

    await user.click(screen.getByTestId('confirm-recruit-button'));

    expect(await screen.findByText('DEPARTMENT UNAVAILABLE')).toBeInTheDocument();
  });

  it('12. a team-full error displays after confirming recruit', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('TEAM_FULL'));

    await user.click(screen.getByTestId('confirm-recruit-button'));

    expect(await screen.findByText('TEAM FULL')).toBeInTheDocument();
  });

  it('13. reaching 5 / 5 shows the TEAM COMPLETE state instead of "scan another"', async () => {
    const user = userEvent.setup();
    renderRecruitPage(mockTeam({ members: [ceoMember(), ceoMember({ id: 'm2' }), ceoMember({ id: 'm3' }), ceoMember({ id: 'm4' })] }));
    await scanThenOpenConfirm(user);
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: recruitResult(5, 'CAF') } as never);
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: mockTeam({ members: [ceoMember(), ceoMember({ id: 'm2' }), ceoMember({ id: 'm3' }), ceoMember({ id: 'm4' }), ceoMember({ id: 'p1' })] }),
    } as never);

    await user.click(screen.getByTestId('confirm-recruit-button'));
    await screen.findByTestId('scan-result-recruited');

    expect(screen.getByText('TEAM COMPLETE')).toBeInTheDocument();
    expect(screen.getByText('FINALIZE TEAM')).toBeInTheDocument();
    expect(screen.queryByTestId('scan-another-button')).not.toBeInTheDocument();
  });

  it('14. a realtime team-state change (the same mechanism the socket handler uses) is reflected live', async () => {
    const queryClient = renderRecruitPage(mockTeam({ members: [ceoMember()] }));
    expect(screen.getByTestId('ceo-recruit-page')).toBeInTheDocument();

    act(() => {
      queryClient.setQueryData(
        ['my-team'],
        mockTeam({ members: [ceoMember(), ceoMember({ id: 'm2' }), ceoMember({ id: 'm3' }), ceoMember({ id: 'm4' }), ceoMember({ id: 'm5' })] }),
      );
    });

    expect(await screen.findByTestId('team-complete')).toBeInTheDocument();
  });

  it('15. a fresh render (simulating a refresh) restores the correct team state from seeded server data', () => {
    renderRecruitPage(mockTeam({ members: [ceoMember(), ceoMember({ id: 'm2' }), ceoMember({ id: 'm3' }), ceoMember({ id: 'm4' }), ceoMember({ id: 'm5' })] }));
    expect(screen.getByTestId('team-complete')).toBeInTheDocument();
  });
});
