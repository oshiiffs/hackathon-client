import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ParticipantQrPage } from '../src/pages/participant/ParticipantQrPage';
import { CeoRecruitPage } from '../src/pages/ceo/CeoRecruitPage';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { PublicUser, QrIdentity, QrScanResult, Team, TeamMember } from '../src/types/api';

vi.mock('../src/components/QrScanner', () => ({
  QrScanner: ({
    onScan,
    onError,
    paused,
  }: {
    onScan: (text: string) => void;
    onError?: (msg: string) => void;
    paused?: boolean;
  }) => (
    <div data-testid="mock-scanner" data-paused={String(paused)}>
      <button data-testid="mock-scan-trigger" onClick={() => onScan('HACKATHON-PARTICIPANT:mock-token')}>
        simulate scan
      </button>
      <button data-testid="mock-camera-error-trigger" onClick={() => onError?.('No camera found.')}>
        simulate camera error
      </button>
    </div>
  ),
}));

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

function axiosErrorWithCode(code: string) {
  return new AxiosError(
    'Request failed',
    '409',
    { headers: new AxiosHeaders(), method: 'post', url: '/participant/ceo/scan-qr' },
    {},
    { status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: 'nope' } } },
  );
}

function renderQrPage(user = mockUser()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  useAuthStore.setState({ user, status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/participant/qr']}>
        <ParticipantQrPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

function renderRecruitPage(team: Team = mockTeam(), user = mockUser({ id: 'ceo_1', role: 'CEO' })) {
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
}

describe('QR identity + CEO scanner (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. the participant QR page renders with the required heading and instructions', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { qrToken: 'abc', qrPayload: 'HACKATHON-PARTICIPANT:abc' } as QrIdentity } as never);
    renderQrPage();

    expect(screen.getByText('NEXUS MULTIVERSE 2026')).toBeInTheDocument();
    expect(screen.getByText('MY TEAM QR')).toBeInTheDocument();
    expect(await screen.findByText('Show this QR code to your CEO.')).toBeInTheDocument();
  });

  it('2. the QR code renders after the API response resolves', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { qrToken: 'abc', qrPayload: 'HACKATHON-PARTICIPANT:abc' } as QrIdentity } as never);
    const { container } = { container: document.body };
    renderQrPage();

    await screen.findByText('Show this QR code to your CEO.');
    expect(container.querySelector('svg')).toBeTruthy();
    // The raw secret must never appear as visible plain text next to the QR.
    expect(screen.queryByText('abc')).not.toBeInTheDocument();
  });

  it('3. shows a loading state while the QR is being fetched', () => {
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    vi.spyOn(apiClient, 'get').mockReturnValueOnce(pending as never);

    renderQrPage();
    expect(screen.getByText('Generating your QR code…')).toBeInTheDocument();

    resolveRequest({ data: { qrToken: 'abc', qrPayload: 'HACKATHON-PARTICIPANT:abc' } });
  });

  it('4. shows an error state with a retry button if the QR request fails', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('network down'));
    renderQrPage();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('5. the CEO scanner page renders with the required heading and instructions', () => {
    renderRecruitPage();
    expect(screen.getByText('SCAN TEAM MEMBER')).toBeInTheDocument();
    expect(screen.getByText('Point the camera at a participant QR code.')).toBeInTheDocument();
    expect(screen.getByTestId('mock-scanner')).toBeInTheDocument();
  });

  it('6. shows a camera-unavailable state when the scanner reports a camera error', async () => {
    const user = userEvent.setup();
    renderRecruitPage();
    await user.click(screen.getByTestId('mock-camera-error-trigger'));

    expect(await screen.findByTestId('camera-unavailable')).toBeInTheDocument();
    expect(screen.getByText('No camera found.')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-scanner')).not.toBeInTheDocument();
  });

  it('7. a successful scan shows the MEMBER FOUND result with name, department, and status', async () => {
    const user = userEvent.setup();
    const result: QrScanResult = {
      valid: true,
      participant: { id: 'p1', name: 'Juan Dela Cruz', department: 'COE' },
      recruitment: { currentlyDrafted: false, departmentAvailable: true },
    };
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: result } as never);

    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));

    expect(await screen.findByTestId('scan-result-found')).toBeInTheDocument();
    expect(screen.getByText('MEMBER FOUND')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('COE')).toBeInTheDocument();
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByTestId('continue-to-recruit-button')).toBeInTheDocument();
  });

  it('8. an invalid QR shows a clean rejection state with a retry option', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('QR_MALFORMED'));

    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));

    expect(await screen.findByTestId('scan-result-rejected')).toBeInTheDocument();
    expect(screen.getByTestId('scan-another-button')).toBeInTheDocument();
  });

  it('9. an already-drafted participant shows the NOT AVAILABLE result', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('PARTICIPANT_ALREADY_DRAFTED'));

    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));

    expect(await screen.findByText('NOT AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText(/already been recruited by another team/)).toBeInTheDocument();
  });

  it('10. an occupied department shows the DEPARTMENT UNAVAILABLE result', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('DEPARTMENT_UNAVAILABLE'));

    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));

    expect(await screen.findByText('DEPARTMENT UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText(/already occupied by your team/)).toBeInTheDocument();
  });

  it('11. the scanner is paused immediately after a detection, and stays paused while the result is shown', async () => {
    const user = userEvent.setup();
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockReturnValueOnce(pending as never);

    renderRecruitPage();
    const trigger = screen.getByTestId('mock-scan-trigger');
    await user.click(trigger);
    await user.click(trigger); // a second in-flight camera frame detecting the same code

    expect(screen.getByTestId('mock-scanner')).toHaveAttribute('data-paused', 'true');
    expect(postSpy).toHaveBeenCalledTimes(1);

    resolveRequest({
      data: { valid: true, participant: { id: 'p1', name: 'Juan', department: 'COE' }, recruitment: { currentlyDrafted: false, departmentAvailable: true } },
    });
  });

  it('12. "SCAN ANOTHER" resets the flow back to scanning', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('QR_NOT_FOUND'));

    renderRecruitPage();
    await user.click(screen.getByTestId('mock-scan-trigger'));
    await screen.findByTestId('scan-result-rejected');

    await user.click(screen.getByTestId('scan-another-button'));

    expect(screen.queryByTestId('scan-result-rejected')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-scanner')).toHaveAttribute('data-paused', 'false');
  });

  // Phase 6's "CONTINUE TO RECRUIT does not call any recruitment endpoint"
  // placeholder test was here — Phase 7 replaces that no-op confirmation with
  // a real confirm dialog + atomic recruit call. See qrRecruitment.test.tsx
  // for "RECRUIT MEMBER" → confirm dialog → actual recruitment coverage.
});
