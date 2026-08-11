import { Outlet } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { NavTab } from '../NavTab';

export function JudgeLayout() {
  return (
    <AppShell title="Judge Dashboard" nav={<NavTab to="/judge/teams">Teams</NavTab>}>
      <Outlet />
    </AppShell>
  );
}
