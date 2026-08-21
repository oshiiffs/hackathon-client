import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../hooks/useAuth';
import { AmbientBackground } from './AmbientBackground';
import { Badge } from './Badge';
import { comicButton } from '../lib/comic';

export function AppShell({ title, nav, children }: { title: string; nav?: ReactNode; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-canvas isolate">
      <AmbientBackground />
      <header className="border-b-[3px] border-ink bg-white/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/hackverse-icon.png"
              alt="Nexus Multiverse"
              className="w-9 h-9 rounded-lg object-cover border-[3px] border-ink shadow-[2px_2px_0px_#111111]"
            />
            <h1 className="text-lg font-black uppercase tracking-wide text-ink">{title}</h1>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-navy font-bold hidden sm:inline">{user.fullName}</span>
              <Badge tone={user.role === 'CEO' ? 'gold' : 'primary'}>{user.role}</Badge>
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className={comicButton('white', 'sm')}
              >
                Log out
              </button>
            </div>
          )}
        </div>
        {nav && <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 flex-wrap">{nav}</div>}
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
