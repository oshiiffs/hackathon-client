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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-black">
            H
          </span>
          <h1 className="text-2xl font-black text-center text-slate-50">Hackathon App</h1>
        </div>
        <p className="text-center text-slate-400 text-sm mb-6">Team Building &amp; Pitch</p>

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
  );
}
