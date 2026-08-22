import { useState, type CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { AmbientBackground } from '../../components/AmbientBackground';
import { useLogin } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { getHomePathForUser } from '../../lib/roleRouting';
import { getApiErrorMessage } from '../../lib/apiClient';
import { comicButton } from '../../lib/comic';

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
    <div className="relative min-h-screen bg-canvas flex items-center justify-center px-4 isolate">
      <AmbientBackground />

      <div className="comic-panel relative w-full max-w-sm px-6 py-8" style={{ boxShadow: '8px 8px 0px #111111' }}>
        <span className="absolute -top-3 -left-3 w-7 h-7 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <span className="absolute -bottom-3 -right-3 w-7 h-7 border-[3px] border-ink bg-lime" aria-hidden="true" />

        <div className="flex flex-col items-center gap-3 mb-1">
          <div className="relative">
            <img src="/nexus-icon-v2.png" alt="Nexus Multiverse" className="relative w-36 h-36 object-contain" />
            {/* A small spark orbiting the mark, echoing the logo's own ring-and-globe motif. */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 w-3 h-3 rounded-full bg-crimson border-2 border-ink animate-orbit"
              style={{ '--orbit-radius': '80px' } as CSSProperties}
            />
          </div>
        </div>
        <p className="text-center text-navy font-bold text-xs uppercase tracking-[0.2em] mb-7">Team Building &amp; Pitch</p>

        <div className="flex mb-5 border-[3px] border-ink rounded-lg p-1 text-sm font-black uppercase bg-white gap-1">
          <button
            className={`flex-1 py-1.5 rounded-md transition-transform duration-100 hover:translate-y-0.5 ${
              mode === 'participant' ? 'bg-crimson text-ink shadow-[2px_2px_0px_#111111]' : 'text-navy hover:bg-cream'
            }`}
            onClick={() => setMode('participant')}
          >
            Participant
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md transition-transform duration-100 hover:translate-y-0.5 ${
              mode === 'staff' ? 'bg-crimson text-ink shadow-[2px_2px_0px_#111111]' : 'text-navy hover:bg-cream'
            }`}
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
            <label className="text-sm font-black uppercase text-forest">
              Badge access code
              <input
                autoFocus
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7Q2XR"
                className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-ink tracking-widest font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-crimson"
              />
            </label>
            <button type="submit" disabled={login.isPending || accessCode.length < 4} className={`mt-1 w-full ${comicButton('crimson')}`}>
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
            <label className="text-sm font-black uppercase text-forest">
              Email
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
              />
            </label>
            <label className="text-sm font-black uppercase text-forest">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
              />
            </label>
            <button type="submit" disabled={login.isPending} className={`mt-1 w-full ${comicButton('crimson')}`}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {login.isError && <p className="mt-3 text-sm font-bold text-crimson text-center">{getApiErrorMessage(login.error)}</p>}
      </div>
    </div>
  );
}
