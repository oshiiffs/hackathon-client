import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogin } from '../src/hooks/useAuth';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';

// A minimal harness around the bare hook — this codebase's other tests all
// render real pages, so a tiny component (rather than renderHook) stays
// consistent with that pattern.
function LoginHarness() {
  const login = useLogin();
  return (
    <button onClick={() => login.mutate({ accessCode: 'ABC123' })} disabled={login.isPending}>
      Log in
    </button>
  );
}

describe('useLogin — shared-kiosk cache safety', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it("clears the entire query cache on a successful login, so a previous device user's stale/errored queries (e.g. ['my-qr']'s 403) are never served to whoever just logged in", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Simulate a leftover cached error from whoever used this device before
    // (e.g. a CEO's "only participants have a recruitment QR code" 403) —
    // this is what a real shared kiosk would still be holding in memory.
    queryClient.setQueryData(['my-qr'], undefined);
    queryClient.getQueryCache().build(queryClient, { queryKey: ['my-qr'] }).setState({
      status: 'error',
      error: new Error('Only participants have a recruitment QR code.'),
      fetchStatus: 'idle',
    });
    expect(queryClient.getQueryState(['my-qr'])?.status).toBe('error');

    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        user: {
          id: 'new_user',
          fullName: 'Fresh Participant',
          email: null,
          homeDepartment: 'CCS',
          slotDepartment: null,
          role: 'PARTICIPANT',
          drafted: false,
          teamId: null,
          nickname: null,
          bio: null,
          skills: [],
          avatarUrl: null,
        },
      },
    } as never);

    render(
      <QueryClientProvider client={queryClient}>
        <LoginHarness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByText('Log in'));

    expect(queryClient.getQueryState(['my-qr'])).toBeUndefined();
    expect(useAuthStore.getState().user?.fullName).toBe('Fresh Participant');
  });
});
