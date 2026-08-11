import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from '../src/AppRoutes';
import { useAuthStore } from '../src/store/authStore';
import type { PublicUser } from '../src/types/api';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'user_1',
    fullName: 'Test User',
    email: null,
    homeDepartment: 'CCS',
    slotDepartment: null,
    role: 'PARTICIPANT',
    drafted: false,
    teamId: null,
    ...overrides,
  };
}

describe('Protected frontend routes', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
  });

  it('redirects an unauthenticated visitor away from a protected route, to /login', () => {
    useAuthStore.setState({ user: null, status: 'unauthenticated' });
    renderAt('/admin/dashboard');
    expect(screen.getByText(/hackathon app/i)).toBeInTheDocument();
  });

  it('renders the admin dashboard shell for an authenticated ADMIN', async () => {
    useAuthStore.setState({ user: mockUser({ role: 'ADMIN' }), status: 'authenticated' });
    renderAt('/admin/dashboard');
    // AdminLayout/AdminDashboardPage are lazy-loaded, so the Suspense fallback
    // renders first — findByText waits for the dynamic import to resolve.
    expect(await screen.findByText(/Admin — Main Controller/i)).toBeInTheDocument();
  });

  it('shows a 403 Unauthorized state when a PARTICIPANT tries to reach the admin dashboard', () => {
    useAuthStore.setState({ user: mockUser({ role: 'PARTICIPANT' }), status: 'authenticated' });
    renderAt('/admin/dashboard');
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText(/don.t have access/i)).toBeInTheDocument();
  });

  it('renders the participant dashboard shell for an authenticated PARTICIPANT', () => {
    useAuthStore.setState({ user: mockUser({ role: 'PARTICIPANT' }), status: 'authenticated' });
    renderAt('/participant');
    expect(screen.getByText('Participant')).toBeInTheDocument();
  });

  it('shows a 403 Unauthorized state when a CEO tries to reach the judge dashboard', () => {
    useAuthStore.setState({ user: mockUser({ role: 'CEO' }), status: 'authenticated' });
    renderAt('/judge/teams');
    expect(screen.getByText('403')).toBeInTheDocument();
  });

  it('renders a 404 state for an unknown path', () => {
    useAuthStore.setState({ user: mockUser({ role: 'ADMIN' }), status: 'authenticated' });
    renderAt('/this-route-does-not-exist');
    expect(screen.getByText('404')).toBeInTheDocument();
  });
});
