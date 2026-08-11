import type { PublicUser } from '../types/api';

/**
 * Single source of truth for "where does this user land" — used by both the
 * post-login redirect and the '/' dispatcher, so the mapping never drifts
 * between the two call sites.
 */
export function getHomePathForUser(user: PublicUser): string {
  switch (user.role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'JUDGE':
      return '/judge/teams';
    case 'CEO':
      return '/ceo';
    default:
      return user.drafted ? '/team' : '/participant';
  }
}
