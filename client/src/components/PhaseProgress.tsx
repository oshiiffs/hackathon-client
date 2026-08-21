import type { HackathonPhase } from '../types/api';
import { comicHeading } from '../lib/comic';

const PHASE_ORDER: HackathonPhase[] = [
  'LOBBY',
  'CEO_CHALLENGE_ACTIVE',
  'DRAFTING',
  'SUBMISSIONS_OPEN',
  'SUBMISSIONS_LOCKED',
  'JUDGING',
  'COMPLETE',
];

// Friendlier than the server's PHASE_LABELS (those are for the compact admin
// stat card, e.g. "TEAM_FORMATION") — this is a step title in a full-width list.
const PHASE_TITLES: Record<HackathonPhase, string> = {
  LOBBY: 'Waiting Room',
  CEO_CHALLENGE_ACTIVE: 'CEO Challenge',
  DRAFTING: 'Team Formation',
  SUBMISSIONS_OPEN: 'Submissions',
  SUBMISSIONS_LOCKED: 'Submissions Closed',
  JUDGING: 'Judging',
  COMPLETE: 'Complete',
};

/** Whole-event progress, phase by phase, so a participant always knows where
 * things stand and what's still ahead — not just the current phase's label. */
export function PhaseProgress({ currentPhase }: { currentPhase: HackathonPhase | undefined }) {
  const currentIndex = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;

  return (
    <section className="comic-panel p-6" data-testid="phase-progress">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
      <h2 className={`text-lg mb-5 ${comicHeading}`}>Event Progress</h2>
      <div className="overflow-x-auto">
        <ol className="flex items-start min-w-max">
          {PHASE_ORDER.map((phase, index) => {
            const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
            const isLast = index === PHASE_ORDER.length - 1;
            return (
              <li key={phase} className="flex items-start">
                <div className="flex flex-col items-center gap-1.5 w-24 text-center">
                  <div
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black border-[3px] border-ink ${
                      status === 'done'
                        ? 'bg-forest text-cream'
                        : status === 'current'
                          ? 'bg-crimson text-ink animate-pulse'
                          : 'bg-white text-navy/40'
                    }`}
                  >
                    {status === 'done' ? '✓' : index + 1}
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase leading-tight ${
                      status === 'current' ? 'text-crimson' : status === 'done' ? 'text-forest' : 'text-navy/40'
                    }`}
                  >
                    {PHASE_TITLES[phase]}
                  </span>
                </div>
                {!isLast && (
                  <div className={`h-1 w-8 mt-3.5 border-y border-ink ${index < currentIndex ? 'bg-forest' : 'bg-white'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
