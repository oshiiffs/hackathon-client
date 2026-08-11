import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../hooks/useAuth';
import { Badge } from './Badge';

export function AppShell({ title, nav, children }: { title: string; nav?: ReactNode; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white font-black text-sm">
              H
            </span>
            <h1 className="text-lg font-bold text-slate-100">{title}</h1>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-400 hidden sm:inline">{user.fullName}</span>
              <Badge tone={user.role === 'CEO' ? 'gold' : 'primary'}>{user.role}</Badge>
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 transition"
              >
                Log out
              </button>
            </div>
          )}
        </div>
        {nav && <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1">{nav}</div>}
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
