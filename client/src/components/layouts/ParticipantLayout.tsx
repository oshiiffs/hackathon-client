import { Outlet } from 'react-router-dom';
import { AppShell } from '../AppShell';

export function ParticipantLayout() {
  return (
    <AppShell title="Participant">
      <Outlet />
    </AppShell>
  );
}
