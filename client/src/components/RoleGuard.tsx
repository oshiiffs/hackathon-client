import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getHomePathForUser } from '../lib/roleRouting';
import { UnauthorizedState } from './StateViews';
import type { UserRole } from '../types/api';

// By the time these guards render, SessionBootstrap has already resolved
// GET /api/auth/me, so `status` here is always 'authenticated' or
// 'unauthenticated' — never 'idle'/'loading'.

export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: UserRole[] }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status !== 'authenticated' || !user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <UnauthorizedState homePath={getHomePathForUser(user)} />;
  return <Outlet />;
}
