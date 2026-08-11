import { Outlet } from 'react-router-dom';
import { AppShell } from '../AppShell';

export function TeamLayout() {
  return (
    <AppShell title="Team Hub">
      <Outlet />
    </AppShell>
  );
}
