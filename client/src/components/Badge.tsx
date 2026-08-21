import type { ReactNode } from 'react';

type BadgeTone = 'primary' | 'success' | 'warning' | 'gold' | 'neutral' | 'danger';

// Sound-burst pill: thick ink outline + tiny hard shadow, filled with the
// tone's brand color. Gold/brand is reserved for the CEO badge, achievements,
// and other emphasis/premium moments — see the design tokens in index.css.
const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-lime text-ink',
  success: 'bg-lime text-ink',
  warning: 'bg-gold text-ink',
  gold: 'bg-gold text-ink',
  neutral: 'bg-white text-navy',
  danger: 'bg-crimson text-ink',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-[2px_2px_0px_#111111] ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
