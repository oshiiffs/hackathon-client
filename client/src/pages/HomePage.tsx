import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getHomePathForUser } from '../lib/roleRouting';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePathForUser(user)} replace />;
}
