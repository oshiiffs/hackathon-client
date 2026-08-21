import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last-resort safety net for the whole app. Without this, ANY uncaught
 * render/effect error anywhere below it — a third-party library throwing
 * synchronously in a cleanup callback, a bad prop, anything — unmounts the
 * entire React tree with nothing left in <div id="root">, i.e. a blank white
 * page with no indication anything went wrong (see QrScanner's cleanup for
 * one real example this used to let through). This turns that into a
 * recoverable screen instead of a dead end.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div
          className="relative w-full max-w-sm bg-white border-[3px] border-ink rounded-xl p-8 text-center flex flex-col items-center gap-3"
          style={{ boxShadow: '6px 6px 0px #111111' }}
        >
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-crimson" aria-hidden="true" />
          <p className="text-5xl">⚠️</p>
          <h1 className="text-xl font-black uppercase tracking-wide text-navy">Something went wrong</h1>
          <p className="text-sm text-ink">
            This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, let an event admin
            know.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex items-center justify-center gap-1.5 font-black uppercase tracking-wide rounded-lg border-[3px] border-ink shadow-[4px_4px_0px_#111111] transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] px-4 py-2 text-sm bg-forest text-cream hover:bg-forest/90"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
