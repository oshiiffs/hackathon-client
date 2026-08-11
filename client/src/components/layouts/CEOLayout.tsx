import { Outlet } from 'react-router-dom';
import { AppShell } from '../AppShell';

export function CEOLayout() {
  return (
    <AppShell title="CEO Dashboard">
      <Outlet />
    </AppShell>
  );
}
