import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { JudgeDashboardPage } from '../src/pages/judge/JudgeDashboardPage';
import { JudgeTeamDetailPage } from '../src/pages/judge/JudgeTeamDetailPage';
import { apiClient } from '../src/lib/apiClient';
import { RequireRole } from '../src/components/RoleGuard';
import { useAuthStore } from '../src/store/authStore';
import type { JudgeCriteriaResponse, JudgeTeamDetail, JudgeTeamListItem, PublicUser } from '../src/types/api';

function mockJudgeUser(): PublicUser {
  return {
    id: 'judge_1',
    fullName: 'Judge Judy',
    email: 'judge@example.com',
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'JUDGE',
    drafted: false,
    teamId: null,
  };
}

function mockTeamListItem(overrides: Partial<JudgeTeamListItem> = {}): JudgeTeamListItem {
  return {
    id: 'team_1',
    name: 'Jade Innovators',
    category: 'AGRICULTURE',
    memberCount: 5,
    ceo: { name: 'Grace Hopper' },
    evaluationStatus: 'NOT_STARTED',
    ...overrides,
  };
}

const CRITERIA_RESPONSE: JudgeCriteriaResponse = {
  criteria: [
    { id: 'innovation', label: 'Innovation', min: 1, max: 10 },
    { id: 'feasibility', label: 'Feasibility', min: 1, max: 10 },
    { id: 'impact', label: 'Impact', min: 1, max: 10 },
    { id: 'presentation', label: 'Presentation', min: 1, max: 10 },
  ],
  minTotal: 4,
  maxTotal: 40,
};

function mockTeamDetail(overrides: Partial<JudgeTeamDetail> = {}): JudgeTeamDetail {
  return {
    id: 'team_1',
    name: 'Jade Innovators',
    category: 'AGRICULTURE',
    finalizedAt: new Date().toISOString(),
    ceo: { id: 'ceo_1', name: 'Grace Hopper' },
    members: [
      { id: 'p1', name: 'Juan', department: 'COE', isCeo: false },
      { id: 'ceo_1', name: 'Grace Hopper', department: 'CCS', isCeo: true },
      { id: 'p3', name: 'Maria', department: 'CHS', isCeo: false },
      { id: 'p4', name: 'John', department: 'CBM', isCeo: false },
      { id: 'p5', name: 'Ana', department: 'CAF', isCeo: false },
    ],
    memberCount: 5,
    project: {
      title: 'AgriSense',
      description: null,
      problemStatement: 'Crop stress goes undetected.',
      proposedSolution: 'Low-cost sensors.',
      targetUsers: 'Smallholder farmers',
      technologyStack: 'React, Fastify',
    },
    submission: { status: 'SUBMITTED' },
    deliverables: {
      pitchDeck: { status: 'UPLOADED', version: 2, filename: 'deck.pdf', fileUrl: 'https://cloudinary.com/deck.pdf', uploadedBy: 'Grace', createdAt: new Date().toISOString() },
      documents: [{ id: 'doc1', filename: 'spec.docx', fileUrl: 'https://cloudinary.com/spec.docx', size: 2048, uploadedBy: 'Juan', createdAt: new Date().toISOString() }],
      assets: [],
    },
    myEvaluation: { id: null, status: 'NOT_STARTED', scores: null, total: null, comments: null, submittedAt: null, updatedAt: null },
    ...overrides,
  };
}

function axiosErrorWithCode(code: string, status: number) {
  return new AxiosError(
    'Request failed',
    String(status),
    { headers: new AxiosHeaders(), method: 'put', url: '/judge/teams/team_1/evaluation' },
    {},
    { status, statusText: 'Error', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: `Failed: ${code}` } } },
  );
}

function renderDashboard(teams: JudgeTeamListItem[] = [mockTeamListItem()]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  useAuthStore.setState({ user: mockJudgeUser(), status: 'authenticated' });
  vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
    if (url === '/judge/teams') return Promise.resolve({ data: { teams } }) as never;
    return Promise.resolve({ data: {} }) as never;
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/judge/teams']}>
        <Routes>
          <Route path="/judge/teams" element={<JudgeDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

function renderDetail(detail: JudgeTeamDetail = mockTeamDetail()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['judge-criteria'], CRITERIA_RESPONSE);
  queryClient.setQueryData(['judge-team', detail.id], detail);
  useAuthStore.setState({ user: mockJudgeUser(), status: 'authenticated' });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/judge/teams/${detail.id}`]}>
        <Routes>
          <Route path="/judge/teams/:teamId" element={<JudgeTeamDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('Judge dashboard + evaluation (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. the judge dashboard renders', () => {
    renderDashboard();
    expect(screen.getByTestId('judge-dashboard')).toBeInTheDocument();
    expect(screen.getByText('JUDGE DASHBOARD')).toBeInTheDocument();
  });

  it('2. the team list renders', async () => {
    renderDashboard();
    expect(await screen.findByTestId('judge-team-card-team_1')).toBeInTheDocument();
    expect(screen.getByText('Jade Innovators')).toBeInTheDocument();
  });

  it('3. search calls the API with the search term', async () => {
    const queryClient = renderDashboard();
    const getSpy = apiClient.get as unknown as ReturnType<typeof vi.fn>;
    const user = userEvent.setup();
    await user.type(screen.getByTestId('judge-search-input'), 'Jade');
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith('/judge/teams', { params: { search: 'Jade', category: undefined, status: undefined } }),
    );
    void queryClient;
  });

  it('4. status filters call the API with the selected status', async () => {
    renderDashboard();
    const getSpy = apiClient.get as unknown as ReturnType<typeof vi.fn>;
    await userEvent.setup().click(screen.getByTestId('judge-filter-SUBMITTED'));
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith('/judge/teams', { params: { search: undefined, category: undefined, status: 'SUBMITTED' } }),
    );
  });

  it('5. the EVALUATE button links to the team detail page', async () => {
    renderDashboard();
    const link = await screen.findByTestId('judge-evaluate-button-team_1');
    expect(link).toHaveAttribute('href', '/judge/teams/team_1');
  });

  it('5b. a submitted team shows a VIEW button instead of EVALUATE', async () => {
    renderDashboard([mockTeamListItem({ evaluationStatus: 'SUBMITTED' })]);
    expect(await screen.findByTestId('judge-view-button-team_1')).toBeInTheDocument();
    expect(screen.queryByTestId('judge-evaluate-button-team_1')).not.toBeInTheDocument();
  });

  it('6. the team detail page renders', () => {
    renderDetail();
    expect(screen.getByTestId('judge-team-detail')).toBeInTheDocument();
    expect(screen.getByText('Jade Innovators')).toBeInTheDocument();
  });

  it('7. project data renders', () => {
    renderDetail();
    const section = screen.getByTestId('judge-project-section');
    expect(within(section).getByText('AgriSense')).toBeInTheDocument();
    expect(within(section).getByText('Crop stress goes undetected.')).toBeInTheDocument();
  });

  it('8. deliverables render with a VIEW link', () => {
    renderDetail();
    const section = screen.getByTestId('judge-deliverables-section');
    expect(within(section).getByText(/Pitch Deck/)).toBeInTheDocument();
    expect(within(section).getByText('spec.docx (2.0 KB)')).toBeInTheDocument();
  });

  it('9. judging criteria render using the authoritative criteria list', () => {
    renderDetail();
    const section = screen.getByTestId('judge-criteria-section');
    for (const c of CRITERIA_RESPONSE.criteria) {
      expect(within(section).getByTestId(`judge-score-${c.id}`)).toBeInTheDocument();
    }
  });

  it('10. score inputs are constrained to the authoritative min/max', () => {
    renderDetail();
    const input = screen.getByTestId('judge-score-innovation') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('10');
  });

  it('11. an invalid score (out of range in restored data) displays an error and disables save/submit', () => {
    // A real <input type="range"> clamps values a user drags to, but restored
    // draft data could in principle be stale/out-of-range (e.g. after a
    // criteria change) — the component's own validation must catch that
    // independent of the input widget's own clamping.
    const detail = mockTeamDetail({
      myEvaluation: {
        id: 'e1',
        status: 'DRAFT',
        scores: { innovation: 15, feasibility: 7, impact: 9, presentation: 6 },
        total: 37,
        comments: null,
        submittedAt: null,
        updatedAt: new Date().toISOString(),
      },
    });
    renderDetail(detail);
    expect(screen.getByTestId('judge-score-error-innovation')).toBeInTheDocument();
    expect(screen.getByTestId('judge-save-draft-button')).toBeDisabled();
    expect(screen.getByTestId('judge-submit-button')).toBeDisabled();
  });

  it('12. save draft calls the API with scores and updates the UI', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockTeamDetail() } as never);
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { id: 'e1', status: 'DRAFT', scores: { innovation: 5, feasibility: 5, impact: 5, presentation: 5 }, total: 20, comments: null, submittedAt: null, updatedAt: new Date().toISOString() },
    } as never);
    renderDetail();
    await userEvent.setup().click(screen.getByTestId('judge-save-draft-button'));
    await waitFor(() => expect(putSpy).toHaveBeenCalledWith('/judge/teams/team_1/evaluation', expect.objectContaining({ scores: expect.any(Object) })));
    expect(await screen.findByTestId('judge-draft-saved')).toBeInTheDocument();
  });

  it('13. a saved draft restores after a refresh (fresh GET)', () => {
    const detail = mockTeamDetail({
      myEvaluation: { id: 'e1', status: 'DRAFT', scores: { innovation: 9, feasibility: 4, impact: 6, presentation: 3 }, total: 22, comments: 'looks good', submittedAt: null, updatedAt: new Date().toISOString() },
    });
    renderDetail(detail);
    expect(screen.getByTestId('judge-score-innovation')).toHaveValue('9');
    expect(screen.getByText(/TOTAL SCORE: 22/)).toBeInTheDocument();
  });

  it('14. the total updates as scores change', () => {
    renderDetail();
    const before = screen.getByTestId('judge-total-score').textContent;
    fireEvent.change(screen.getByTestId('judge-score-innovation'), { target: { value: '10' } });
    expect(screen.getByTestId('judge-total-score').textContent).not.toBe(before);
  });

  it('15. clicking submit opens a confirmation dialog', async () => {
    renderDetail();
    await userEvent.setup().click(screen.getByTestId('judge-submit-button'));
    expect(screen.getByText('Submit this evaluation?')).toBeInTheDocument();
  });

  it('16. confirming submission calls the API and shows the submitted banner', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        id: 'e1',
        status: 'SUBMITTED',
        scores: { innovation: 5, feasibility: 5, impact: 5, presentation: 5 },
        total: 20,
        comments: null,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } as never);
    const queryClient = renderDetail();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('judge-submit-button'));
    await user.click(screen.getByText('Submit'));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/judge/teams/team_1/evaluation/submit', expect.any(Object)));
    // Simulate the query-cache update a real invalidation/refetch would produce.
    queryClient.setQueryData(['judge-team', 'team_1'], (old: JudgeTeamDetail) => ({
      ...old,
      myEvaluation: { id: 'e1', status: 'SUBMITTED', scores: old.myEvaluation.scores, total: 20, comments: null, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    }));
    expect(await screen.findByTestId('judge-submitted-banner')).toBeInTheDocument();
  });

  it('17. the submitted state disables all score inputs', () => {
    const detail = mockTeamDetail({
      myEvaluation: { id: 'e1', status: 'SUBMITTED', scores: { innovation: 8, feasibility: 7, impact: 9, presentation: 6 }, total: 30, comments: null, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    });
    renderDetail(detail);
    expect(screen.getByTestId('judge-score-innovation')).toBeDisabled();
    expect(screen.queryByTestId('judge-save-draft-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('judge-submit-button')).not.toBeInTheDocument();
  });

  it('18. the submitted state (and its immutability) survives a refresh', () => {
    const detail = mockTeamDetail({
      myEvaluation: { id: 'e1', status: 'SUBMITTED', scores: { innovation: 8, feasibility: 7, impact: 9, presentation: 6 }, total: 30, comments: null, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    });
    renderDetail(detail);
    expect(screen.getByTestId('judge-submitted-banner')).toBeInTheDocument();
    expect(screen.getByText('This evaluation has been submitted and cannot be modified.')).toBeInTheDocument();
  });

  it('19. a non-judge role sees the unauthorized state instead of the dashboard', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ user: { ...mockJudgeUser(), role: 'CEO' }, status: 'authenticated' });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/judge/teams']}>
          <Routes>
            <Route element={<RequireRole roles={['JUDGE']} />}>
              <Route path="/judge/teams" element={<JudgeDashboardPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.queryByTestId('judge-dashboard')).not.toBeInTheDocument();
  });

  it('20. the dashboard grid uses responsive column classes (mobile-first)', async () => {
    renderDashboard();
    const card = await screen.findByTestId('judge-team-card-team_1');
    expect(card.parentElement?.className).toMatch(/sm:grid-cols-2/);
  });

  it('21. no private information (accessCode/qrToken/passwordHash) is ever rendered', () => {
    renderDetail();
    expect(document.body.innerHTML).not.toMatch(/accessCode|qrToken|passwordHash/i);
  });

  it('rejects an error from a failed draft save without crashing', async () => {
    vi.spyOn(apiClient, 'put').mockRejectedValueOnce(axiosErrorWithCode('INVALID_SCORE', 400));
    renderDetail();
    await userEvent.setup().click(screen.getByTestId('judge-save-draft-button'));
    expect(await screen.findByText(/Failed: INVALID_SCORE/)).toBeInTheDocument();
  });
});
