import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackground } from './AmbientBackground';
import { comicButton } from '../lib/comic';

/**
 * Reusable async/empty/error state views, shared across every dashboard instead
 * of each page inventing its own "Loading…" paragraph. Keep these generic —
 * page-specific copy is passed in as props, not hardcoded here.
 */

export function LoadingState({ label = 'Loading…', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const content = (
    <div className="flex flex-col items-center gap-3 text-navy">
      <div className="w-9 h-9 rounded-full border-[3px] border-ink border-t-crimson animate-spin" />
      <p className="text-sm font-bold uppercase tracking-wide">{label}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas isolate">
        <AmbientBackground />
        {content}
      </div>
    );
  }
  return <div className="flex items-center justify-center py-16">{content}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-crimson font-black uppercase tracking-wide text-lg">
        Something went wrong
      </p>
      <p className="text-sm text-navy max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={`mt-1 ${comicButton('white', 'sm')}`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-ink font-black uppercase tracking-wide">{title}</p>
      {description && <p className="text-sm text-navy max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function UnauthorizedState({ homePath }: { homePath: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 isolate">
      <AmbientBackground />
      <div className="comic-panel text-center flex flex-col items-center gap-3 px-8 py-10 max-w-sm">
        <span className="absolute -top-3 -left-3 w-7 h-7 border-[3px] border-ink bg-crimson" aria-hidden="true" />
        <p className="text-6xl font-black text-crimson">403</p>
        <h1 className="text-xl font-black uppercase tracking-wide text-navy">You don&apos;t have access to this page</h1>
        <p className="text-sm text-ink">
          Your account role doesn&apos;t permit viewing this section. If you think this is a mistake, contact an event admin.
        </p>
        <Link to={homePath} className={`mt-2 ${comicButton('forest')}`}>
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}

export function NotFoundState({ homePath }: { homePath: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 isolate">
      <AmbientBackground />
      <div className="comic-panel text-center flex flex-col items-center gap-3 px-8 py-10 max-w-sm">
        <span className="absolute -top-3 -left-3 w-7 h-7 border-[3px] border-ink bg-gold" aria-hidden="true" />
        <p className="text-6xl font-black text-forest">404</p>
        <h1 className="text-xl font-black uppercase tracking-wide text-navy">Page not found</h1>
        <p className="text-sm text-ink">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link to={homePath} className={`mt-2 ${comicButton('forest')}`}>
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}
