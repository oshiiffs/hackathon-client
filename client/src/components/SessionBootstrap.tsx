import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/apiClient';
import { LoadingState } from './StateViews';

/**
 * Runs once per page load: calls GET /api/auth/me to ask Postgres (via the
 * httpOnly session cookie) who's actually logged in, rather than trusting
 * anything persisted client-side. Renders a full-screen loading state until
 * that resolves, then mounts the real app with the store already populated.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    let cancelled = false;
    setLoading();
    apiClient
      .get('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) clear();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'idle' || status === 'loading') {
    return <LoadingState fullScreen label="Checking your session…" />;
  }

  return children;
}
