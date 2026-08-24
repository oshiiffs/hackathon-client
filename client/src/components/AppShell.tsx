import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../hooks/useAuth';
import { AmbientBackground } from './AmbientBackground';
import { Badge } from './Badge';
import { Footer } from './Footer';
import { comicButton } from '../lib/comic';

export function AppShell({ title, nav, children }: { title: string; nav?: ReactNode; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    // flex flex-col + main's flex-1 is what pins the footer to the true
    // bottom of the viewport on a short page (previously plain min-h-screen
    // with normal document flow — a short page's leftover viewport space
    // landed AFTER the footer instead of the footer ever reaching the
    // bottom, showing as a stray gap underneath it).
    <div className="min-h-screen flex flex-col bg-canvas isolate">
      <AmbientBackground />
      <header className="border-b-[3px] border-ink bg-white/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/nexus-logo-full.png" alt="Nexus Multiverse" className="h-12 w-auto object-contain" />
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
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">{children}</main>
      <Footer />
    </div>
  );
}
