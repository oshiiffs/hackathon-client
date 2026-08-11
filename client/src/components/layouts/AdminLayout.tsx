import { Outlet } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { NavTab } from '../NavTab';

export function AdminLayout() {
  return (
    <AppShell
      title="Admin — Main Controller"
      nav={<NavTab to="/admin/dashboard">Dashboard</NavTab>}
    >
      <Outlet />
    </AppShell>
  );
}
