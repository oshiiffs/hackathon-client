import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { getHomePathForUser } from '../../lib/roleRouting';
import { getApiErrorMessage } from '../../lib/apiClient';

export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<'participant' | 'staff'>('participant');
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useLogin();

  if (status === 'authenticated' && user) return <Navigate to={getHomePathForUser(user)} replace />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center px-4">
      {/* Ambient glow, echoing the logo's gold/green globe — brand colors, not decoration for its own sake. */}
      <div className="pointer-events-none absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-accent-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 w-[40rem] h-[40rem] rounded-full bg-primary-500/25 blur-[120px]" />

      <div className="relative w-full max-w-sm rounded-2xl p-px bg-gradient-to-br from-accent-500/60 via-primary-600/30 to-primary-500/60 shadow-2xl">
        <div className="rounded-[15px] bg-slate-900/95 backdrop-blur px-6 py-8">
          <div className="flex flex-col items-center gap-3 mb-1">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary-500/30 blur-2xl" />
              <img src="/hackverse-icon.png" alt="HackVerse" className="relative w-20 h-20 drop-shadow-lg" />
            </div>
            <h1 className="text-3xl font-black text-center tracking-tight">
              <span className="text-accent-400">Hack</span>
              <span className="text-primary-400">Verse</span> <span className="text-slate-100">2026</span>
            </h1>
          </div>
          <p className="text-center text-slate-500 text-xs uppercase tracking-[0.2em] mb-7">Team Building &amp; Pitch</p>

          <div className="flex mb-5 bg-slate-800 rounded-lg p-1 text-sm font-medium">
            <button
              className={`flex-1 py-1.5 rounded-md transition ${mode === 'participant' ? 'bg-primary-600 text-white' : 'text-slate-400'}`}
              onClick={() => setMode('participant')}
            >
              Participant
            </button>
            <button
              className={`flex-1 py-1.5 rounded-md transition ${mode === 'staff' ? 'bg-primary-600 text-white' : 'text-slate-400'}`}
              onClick={() => setMode('staff')}
            >
              Admin / Judge
            </button>
          </div>

          {mode === 'participant' ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate({ accessCode });
              }}
            >
              <label className="text-sm text-slate-300">
                Badge access code
                <input
                  autoFocus
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. K7Q2XR"
                  className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 tracking-widest font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <button
                type="submit"
                disabled={login.isPending || accessCode.length < 4}
                className="mt-1 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold py-2.5 transition"
              >
                {login.isPending ? 'Signing in…' : 'Enter'}
              </button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate({ email, password });
              }}
            >
              <label className="text-sm text-slate-300">
                Email
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <label className="text-sm text-slate-300">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <button
                type="submit"
                disabled={login.isPending}
                className="mt-1 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold py-2.5 transition"
              >
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {login.isError && <p className="mt-3 text-sm text-red-400 text-center">{getApiErrorMessage(login.error)}</p>}
        </div>
      </div>
    </div>
  );
}
