import type { ReactNode } from 'react';

type BadgeTone = 'primary' | 'gold' | 'neutral' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary-500/15 text-primary-300 border-primary-600/40',
  // Gold is reserved for the CEO badge, achievements, and other emphasis/premium
  // moments — see the design tokens in index.css.
  gold: 'bg-accent-500/15 text-accent-300 border-accent-600/50',
  neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  danger: 'bg-red-500/15 text-red-300 border-red-600/40',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
