import { create } from 'zustand';
import type { PublicUser } from '../types/api';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  user: PublicUser | null;
  status: AuthStatus;
  setLoading: () => void;
  setUser: (user: PublicUser) => void;
  clear: () => void;
};

/**
 * Client-side session CACHE only — Postgres (via the httpOnly session cookie +
 * GET /api/auth/me) is the actual source of truth. There is no persisted token
 * here: the JWT lives in an httpOnly cookie the browser manages, which this
 * store never has access to. On every page load, `status` starts at 'idle' and
 * SessionBootstrap resolves it by calling /api/auth/me — see App.tsx.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: 'idle',
  setLoading: () => set({ status: 'loading' }),
  setUser: (user) => set({ user, status: 'authenticated' }),
  clear: () => set({ user: null, status: 'unauthenticated' }),
}));
