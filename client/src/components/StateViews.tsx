import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable async/empty/error state views, shared across every dashboard instead
 * of each page inventing its own "Loading…" paragraph. Keep these generic —
 * page-specific copy is passed in as props, not hardcoded here.
 */

export function LoadingState({ label = 'Loading…', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const content = (
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-primary-500 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );

  if (fullScreen) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950">{content}</div>;
  }
  return <div className="flex items-center justify-center py-16">{content}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-red-400 font-semibold">Something went wrong</p>
      <p className="text-sm text-slate-400 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold px-4 py-2 transition"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-slate-200 font-semibold">{title}</p>
      {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function UnauthorizedState({ homePath }: { homePath: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="text-center flex flex-col items-center gap-3">
        <p className="text-6xl font-black text-accent-500">403</p>
        <h1 className="text-xl font-bold text-slate-100">You don&apos;t have access to this page</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          Your account role doesn&apos;t permit viewing this section. If you think this is a mistake, contact an event admin.
        </p>
        <Link
          to={homePath}
          className="mt-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 transition"
        >
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}

export function NotFoundState({ homePath }: { homePath: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="text-center flex flex-col items-center gap-3">
        <p className="text-6xl font-black text-primary-500">404</p>
        <h1 className="text-xl font-bold text-slate-100">Page not found</h1>
        <p className="text-sm text-slate-500 max-w-sm">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link
          to={homePath}
          className="mt-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 transition"
        >
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}
