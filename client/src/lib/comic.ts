/**
 * Shared Tailwind class fragments for the "Retro Comic Book / Pop-Art"
 * design system — see index.css for the underlying color tokens
 * (ink/forest/gold/lime/cream/crimson/navy/canvas) and the
 * .comic-panel/.comic-heading/.halftone utilities these compose with.
 * Centralized so buttons/panels/headings stay pixel-consistent across
 * every dashboard instead of each page hand-rolling its own shadow offset.
 */

export type ComicTone = 'forest' | 'crimson' | 'gold' | 'lime' | 'white';

const TONE_CLASSES: Record<ComicTone, string> = {
  forest: 'bg-forest text-cream hover:bg-forest/90',
  crimson: 'bg-crimson text-ink hover:bg-crimson/90',
  gold: 'bg-gold text-ink hover:bg-gold/90',
  lime: 'bg-lime text-ink hover:bg-lime/90',
  white: 'bg-white text-ink hover:bg-cream',
};

const PRESS =
  'transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px]';

/** Tactile pill/rect button: thick ink border, hard offset shadow, press-in
 * interaction. Compose with a size string (padding/text-size) at the call
 * site since buttons in this app range from icon-only chips to full CTAs. */
export function comicButton(tone: ComicTone = 'forest', size: 'xs' | 'sm' | 'md' = 'md') {
  const sizeClasses =
    size === 'xs' ? 'px-2.5 py-1 text-[11px]' : size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return `inline-flex items-center justify-center gap-1.5 font-black uppercase tracking-wide rounded-lg border-[3px] border-ink shadow-[4px_4px_0px_#111111] disabled:opacity-50 disabled:pointer-events-none ${PRESS} ${sizeClasses} ${TONE_CLASSES[tone]}`;
}

/** Same tactile treatment for a text-only link-button (no fill/border) —
 * used for inline "Edit" / "Add" style affordances. */
export const comicLink = 'font-bold uppercase tracking-wide text-forest hover:text-crimson transition-colors';

export const comicPanel = 'comic-panel';
export const comicPanelSm = 'comic-panel-sm';
export const comicHeading = 'comic-heading';
export const comicHeadingSm = 'comic-heading-sm';

/** Small geometric corner accent block — the recurring "torn panel corner"
 * flourish. Absolutely positioned; parent must be `relative` (comic-panel
 * already is). */
export function comicCorner(tone: 'gold' | 'lime' | 'forest' = 'gold', position = '-top-2 -left-2') {
  const bg = tone === 'gold' ? 'bg-gold' : tone === 'lime' ? 'bg-lime' : 'bg-forest';
  return `absolute ${position} w-5 h-5 border-[3px] border-ink ${bg} pointer-events-none`;
}
