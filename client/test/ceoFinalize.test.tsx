import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Every deadline is relative to THIS, not Date.now() at call time — keeps a
// whole test's set of timestamps internally consistent even if a little
// wall-clock time passes while building the mock.
const NOW = Date.now();

/** Deadlines default to "not started yet" (both null == still recruiting).
 * Pass `nameEndsInMs`/`categoryEndsInMs` (negative = already in the past) to
 * land on a specific step without waiting out a real countdown — the page
 * derives its step purely from these vs. a server-clock-corrected "now", so
 * this is the same trick a real page refresh mid-countdown relies on. */
function mockStatus(
  overrides: Partial<FinalizationStatus> & { nameEndsInMs?: number; categoryEndsInMs?: number } = {},
): FinalizationStatus {
  const { nameEndsInMs, categoryEndsInMs, ...rest } = overrides;
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
    nameSelectionEndsAt: nameEndsInMs !== undefined ? new Date(NOW + nameEndsInMs).toISOString() : null,
    categorySelectionEndsAt: categoryEndsInMs !== undefined ? new Date(NOW + categoryEndsInMs).toISOString() : null,
    serverNow: new Date(NOW).toISOString(),
    ...rest,
  };
}

/** Shorthand for a team mid-CEO-Name-Selection: timer running, category
 * timer not started yet. */
function nameStepStatus(overrides: Partial<FinalizationStatus> = {}) {
  return mockStatus({ nameEndsInMs: 45_000, ...overrides });
}

/** Shorthand for a team past its name deadline but before the transition
 * video has reported done (categorySelectionEndsAt still null) — the video
 * step. */
function videoStepStatus(overrides: Partial<FinalizationStatus> = {}) {
  return mockStatus({ nameEndsInMs: -1000, team: mockTeam({ name: 'Jade Innovators', members: fullRoster(), isComplete: true }), ...overrides });
}

/** Shorthand for a team mid-HEAT-Category-Selection: name timer closed,
 * category timer running. */
function categoryStepStatus(overrides: Partial<FinalizationStatus> = {}) {
  return mockStatus({
    nameEndsInMs: -60_000,
    categoryEndsInMs: 30_000,
    team: mockTeam({ name: 'Jade Innovators', members: fullRoster(), isComplete: true }),
    ...overrides,
  });
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

describe('Team finalization (frontend, timer-driven)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. still recruiting: shows the not-ready panel, no timer, no name input, no leftover buttons', () => {
    renderFinalizePage(
      mockStatus({
        memberCount: 4,
        canFinalize: false,
        reason: 'TEAM_NOT_COMPLETE',
        team: mockTeam({ members: fullRoster().slice(0, 4) }),
      }),
    );
    expect(screen.getByTestId('not-ready-step')).toBeInTheDocument();
    expect(screen.getByTestId('finalize-not-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('team-name-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('name-selection-timer')).not.toBeInTheDocument();
    expect(screen.queryByText(/continue to heat selection/i)).not.toBeInTheDocument();
    // Regression: a freshly-promoted CEO now lands directly on THIS page
    // (see ParticipantChallengePage's post-congratulations auto-redirect,
    // which skips CeoDashboardPage entirely) — without this link, "still
    // recruiting" was a dead end with no way to reach the QR scanner.
    expect(screen.getByTestId('not-ready-scan-member-link')).toHaveAttribute('href', '/ceo/recruit');
  });

  it("1b. the not-ready panel's recruit link is absent once the roster is genuinely full (a different not-ready reason)", () => {
    renderFinalizePage(mockStatus({ canFinalize: false, reason: 'PHASE_NOT_ALLOWED' }));
    expect(screen.queryByTestId('not-ready-scan-member-link')).not.toBeInTheDocument();
  });

  it('2. all five departments render with their completion state', () => {
    renderFinalizePage();
    for (const dept of ['COE', 'CCS', 'CHS', 'CBM', 'CAF']) {
      expect(screen.getAllByText(new RegExp(dept)).length).toBeGreaterThan(0);
    }
  });

  it('3. once ready, the CEO Name Selection timer and name input show — with no Continue button anywhere', () => {
    renderFinalizePage(nameStepStatus());
    expect(screen.getByTestId('team-ready-step')).toBeInTheDocument();
    expect(screen.getByTestId('name-selection-timer')).toBeInTheDocument();
    expect(screen.getByTestId('team-name-input')).toBeInTheDocument();
    expect(screen.queryByTestId('continue-to-category-button')).not.toBeInTheDocument();
    expect(screen.queryByText(/continue to heat selection/i)).not.toBeInTheDocument();
  });

  it('4. the team name input accepts typed text immediately', async () => {
    const user = userEvent.setup();
    renderFinalizePage(nameStepStatus());
    const input = screen.getByTestId('team-name-input') as HTMLInputElement;
    await user.type(input, 'Jade Innovators');
    expect(input.value).toBe('Jade Innovators');
  });

  it('5. the typed name autosaves (debounced) without any submit button', async () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: nameStepStatus() } as never);
    renderFinalizePage(nameStepStatus());
    fireEvent.change(screen.getByTestId('team-name-input'), { target: { value: 'Jade Innovators' } });

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(patchSpy).toHaveBeenCalledWith('/participant/ceo/finalize/draft', { name: 'Jade Innovators' });
  });

  it('6. once the name timer closes, the transition video plays automatically — no button required', () => {
    renderFinalizePage(videoStepStatus());
    expect(screen.getByTestId('video-step')).toBeInTheDocument();
    expect(screen.getByTestId('heat-category-video')).toBeInTheDocument();
    expect(screen.queryByTestId('team-ready-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-step')).not.toBeInTheDocument();
  });

  it('7. the video ending starts the HEAT Category Selection timer server-side', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: categoryStepStatus() } as never);
    renderFinalizePage(videoStepStatus());

    fireEvent.ended(screen.getByTestId('heat-category-video'));

    await vi.waitFor(() => expect(postSpy).toHaveBeenCalledWith('/participant/ceo/finalize/start-category-timer'));
  });

  it('8. a broken video still starts the category timer instead of leaving the team stuck', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: categoryStepStatus() } as never);
    renderFinalizePage(videoStepStatus());

    fireEvent.error(screen.getByTestId('heat-category-video'));

    expect(screen.getByTestId('heat-category-video-error')).toBeInTheDocument();
    await vi.waitFor(() => expect(postSpy).toHaveBeenCalledWith('/participant/ceo/finalize/start-category-timer'));
  });

  it('8b. shows the real team name over heat-default.mp4\'s baked "(STARTUP)" placeholder during — and only during — those two windows', () => {
    renderFinalizePage(videoStepStatus({ team: mockTeam({ name: 'Jade Innovators', members: fullRoster(), isComplete: true }) }));
    const video = screen.getByTestId('heat-category-video') as HTMLVideoElement;

    // Before either window: neither overlay renders.
    expect(screen.queryByTestId('heat-video-greeting-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('heat-video-sector-name')).not.toBeInTheDocument();

    // Inside the "GREETINGS! (STARTUP)" window.
    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    expect(screen.getByTestId('heat-video-greeting-name')).toHaveTextContent('(JADE INNOVATORS)');
    expect(screen.queryByTestId('heat-video-sector-name')).not.toBeInTheDocument();

    // Between the two windows: neither overlay renders.
    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    expect(screen.queryByTestId('heat-video-greeting-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('heat-video-sector-name')).not.toBeInTheDocument();

    // Inside the "(STARTUP) THE PHILIPPINES NEEDS YOU..." window.
    video.currentTime = 25;
    fireEvent.timeUpdate(video);
    expect(screen.queryByTestId('heat-video-greeting-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('heat-video-sector-name')).toHaveTextContent('(JADE INNOVATORS)');
  });

  it('8c. falls back to a generic placeholder if the CEO left the team name blank', () => {
    renderFinalizePage(videoStepStatus({ team: mockTeam({ name: null, members: fullRoster(), isComplete: true }) }));
    const video = screen.getByTestId('heat-category-video') as HTMLVideoElement;

    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    expect(screen.getByTestId('heat-video-greeting-name')).toHaveTextContent('(YOUR STARTUP)');
  });

  it('9. HEAT capacities render for all four categories once the category timer is running — no Finalize button anywhere', () => {
    renderFinalizePage(categoryStepStatus());
    expect(screen.getByTestId('category-step')).toBeInTheDocument();
    expect(screen.getByTestId('category-selection-timer')).toBeInTheDocument();
    expect(screen.getByTestId('category-button-HEALTH')).toHaveTextContent('1 / 3');
    expect(screen.getByTestId('category-button-ENVIRONMENT')).toHaveTextContent('2 / 3');
    expect(screen.getByTestId('category-button-AGRICULTURE')).toHaveTextContent('3 / 3');
    expect(screen.getByTestId('category-button-TOURISM')).toHaveTextContent('0 / 3');
    expect(screen.queryByTestId('finalize-team-button')).not.toBeInTheDocument();
    expect(screen.queryByText(/^finalize team$/i)).not.toBeInTheDocument();
  });

  it('10. a full category button is disabled', () => {
    renderFinalizePage(categoryStepStatus());
    expect(screen.getByTestId('category-button-AGRICULTURE')).toBeDisabled();
    expect(screen.getByTestId('category-button-HEALTH')).not.toBeDisabled();
  });

  it('11. clicking a category autosaves the tentative pick — no confirmation dialog', async () => {
    const user = userEvent.setup();
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: categoryStepStatus({ team: mockTeam({ name: 'Jade Innovators', category: 'TOURISM', members: fullRoster(), isComplete: true }) }) } as never);
    renderFinalizePage(categoryStepStatus());

    await user.click(screen.getByTestId('category-button-TOURISM'));

    expect(patchSpy).toHaveBeenCalledWith('/participant/ceo/finalize/draft', { category: 'TOURISM' });
    expect(screen.queryByTestId('finalize-confirm-dialog')).not.toBeInTheDocument();
  });

  it('11b. the tapped category highlights immediately, before the save round-trip resolves', async () => {
    const user = userEvent.setup();
    // Held open (not resolved) for the duration of the two assertions below
    // — simulates a slow/cold-starting backend. If the ring only ever came
    // from the server's own echo (the bug this guards against), it would
    // never appear here at all. Resolved at the end (not left dangling
    // forever) so this test doesn't leave a stray pending promise/timer that
    // could bleed into whichever test runs next.
    let resolvePatch!: (value: unknown) => void;
    vi.spyOn(apiClient, 'patch').mockReturnValue(new Promise((resolve) => (resolvePatch = resolve)));
    // Also mock GET: useFinalizationStatus's staleTime: 0 means a background
    // refetch is fair game at any point this component stays mounted, and
    // this test deliberately keeps it mounted a bit longer than most
    // (holding the patch open across two assertions with a click in
    // between). Left unmocked, that refetch is a real, unmocked network call
    // in jsdom — which fails, and the page treats ANY error from it as fatal
    // (renders the full ErrorState) even with perfectly good cached data
    // still in hand, wiping out the very buttons this test is asserting on.
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: categoryStepStatus() } as never);
    renderFinalizePage(categoryStepStatus());

    expect(screen.getByTestId('category-icon-TOURISM').className).not.toMatch(/ring-crimson/);
    await user.click(screen.getByTestId('category-button-TOURISM'));
    expect(screen.getByTestId('category-icon-TOURISM').className).toMatch(/ring-crimson/);

    resolvePatch({ data: categoryStepStatus({ team: mockTeam({ name: 'Jade Innovators', category: 'TOURISM', members: fullRoster(), isComplete: true }) }) });
  });

  it('12. the selected category is visually highlighted from server state', () => {
    renderFinalizePage(categoryStepStatus({ team: mockTeam({ name: 'Jade Innovators', category: 'TOURISM', members: fullRoster(), isComplete: true }) }));
    expect(screen.getByTestId('category-icon-TOURISM').className).toMatch(/ring-crimson/);
    expect(screen.getByTestId('category-icon-HEALTH').className).not.toMatch(/ring-crimson/);
  });

  it('13. once the category timer has closed and the team is not yet finalized, shows a locking-in state', () => {
    renderFinalizePage(mockStatus({ nameEndsInMs: -60_000, categoryEndsInMs: -1000, team: mockTeam({ name: 'Jade Innovators', members: fullRoster(), isComplete: true }) }));
    expect(screen.getByTestId('locking-in')).toBeInTheDocument();
  });

  it('14. a finalized team shows the success state with its category-matched reveal video', () => {
    renderFinalizePage(
      mockStatus({ team: mockTeam({ name: 'Jade Innovators', category: 'TOURISM', finalizedAt: new Date().toISOString(), members: fullRoster(), isComplete: true }) }),
    );
    expect(screen.getByTestId('finalize-success')).toBeInTheDocument();
    const video = screen.getByTestId('heat-category-reveal-video') as HTMLVideoElement;
    expect(video.querySelector('source')).toHaveAttribute('src', '/videos/heat-tourism-v2.mp4');
    expect(screen.getByText('OPEN TEAM HUB')).toBeInTheDocument();
  });

  it('15. "OPEN TEAM HUB" navigates to the Team Hub', async () => {
    const user = userEvent.setup();
    renderFinalizePage(
      mockStatus({ team: mockTeam({ name: 'Jade Innovators', category: 'TOURISM', finalizedAt: new Date().toISOString(), members: fullRoster(), isComplete: true }) }),
    );
    await user.click(screen.getByText('OPEN TEAM HUB'));
    expect(await screen.findByTestId('team-hub-landing')).toBeInTheDocument();
  });

  it('16. a normal participant cannot reach the CEO finalization page (403)', () => {
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

  it('17. a fresh render (simulating a page refresh) lands on the correct step directly from the server deadlines alone', () => {
    // Name timer long closed, category timer freshly started — a refresh
    // mid-HEAT-Category-Selection must land right back on that step, not
    // replay the video or reset to team-ready.
    renderFinalizePage(categoryStepStatus());
    expect(screen.getByTestId('category-step')).toBeInTheDocument();
    expect(screen.queryByTestId('team-ready-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-step')).not.toBeInTheDocument();
  });

  it('18. a realtime capacity update (the same mechanism the socket handler uses) is reflected live', async () => {
    const queryClient = renderFinalizePage(categoryStepStatus());
    expect(screen.getByTestId('category-button-TOURISM')).toHaveTextContent('0 / 3');

    act(() => {
      queryClient.setQueryData(['finalization-status'], categoryStepStatus({ categories: mockCategories({ TOURISM: { used: 3, available: 0, full: true } }) }));
    });

    expect(await screen.findByTestId('category-button-TOURISM')).toHaveTextContent('3 / 3');
    expect(screen.getByTestId('category-button-TOURISM')).toBeDisabled();
  });

  it('19. a complete-but-not-finalized team dashboard still links to the finalization page', () => {
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

  it('20. no step ever renders a Continue-to-HEAT-Selection or Finalize-Team button, disabled or otherwise', () => {
    for (const status of [nameStepStatus(), videoStepStatus(), categoryStepStatus()]) {
      const { unmount } = render(
        <QueryClientProvider client={(() => {
          const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
          qc.setQueryData(['finalization-status'], status);
          return qc;
        })()}>
          <MemoryRouter initialEntries={['/ceo/team/finalize']}>
            <Routes>
              <Route path="/ceo/team/finalize" element={<CeoFinalizePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      useAuthStore.setState({ user: mockUser(), status: 'authenticated' });
      expect(screen.queryByTestId('continue-to-category-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('finalize-team-button')).not.toBeInTheDocument();
      expect(screen.queryByText(/continue to heat selection/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^finalize team$/i)).not.toBeInTheDocument();
      unmount();
    }
  });
});
