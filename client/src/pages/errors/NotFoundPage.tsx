import { useAuthStore } from '../../store/authStore';
import { getHomePathForUser } from '../../lib/roleRouting';
import { NotFoundState } from '../../components/StateViews';

export function NotFoundPage() {
  const user = useAuthStore((s) => s.user);
  return <NotFoundState homePath={user ? getHomePathForUser(user) : '/login'} />;
}
