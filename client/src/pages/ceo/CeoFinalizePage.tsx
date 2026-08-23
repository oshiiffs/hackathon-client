import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useFinalizationStatus, useSaveFinalizeDraft, useStartCategoryTimer } from '../../hooks/useFinalization';
import { getApiErrorMessage } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';
import { HEAT_CATEGORY_ICONS, HEAT_CATEGORY_VIDEOS, HEAT_DEFAULT_VIDEO } from '../../lib/heatCategoryAssets';
import { ALL_DEPARTMENTS, type HeatCategory, type Team } from '../../types/api';

const CATEGORY_LABELS: Record<HeatCategory, string> = {
  HEALTH: 'HEALTH',
  ENVIRONMENT: 'ENVIRONMENT',
  AGRICULTURE: 'AGRICULTURE',
  TOURISM: 'TOURISM',
};

// Entirely server-driven — every step boundary is a deadline in Postgres
// (Team.nameSelectionEndsAt/categorySelectionEndsAt), not client state, so a
// refresh mid-countdown always lands back on the correct step. 'not-ready'
// covers both "still recruiting" (timer never started) and the brief instant
// after a timer expires before its follow-up write lands.
type FinalizeStep = 'not-ready' | 'team-ready' | 'video' | 'category' | 'locking-in';

/** A continuously-ticking, clock-skew-corrected "now" (ms) — the same
 * offset-once/tick-forever technique useSyncedTopic uses for the CEO
 * challenge's synchronized clock, just without the topic-cycling math this
 * page doesn't need. Drives step derivation between the 2s status polls. */
function useTickingNow(serverNow: string | undefined): number {
  const [, forceTick] = useState(0);
  const offsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (serverNow && offsetRef.current === null) {
      offsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, [serverNow]);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 250);
    return () => clearInterval(interval);
  }, []);

  return Date.now() + (offsetRef.current ?? 0);
}

/** Three-segment progress line — Team Name / Video / HEAT Category — purely
 * visual. */
function StepIndicator({ step }: { step: FinalizeStep }) {
  const segments: { key: FinalizeStep[]; label: string }[] = [
    { key: ['not-ready', 'team-ready'], label: 'Team Name' },
    { key: ['video'], label: 'Video' },
    { key: ['category', 'locking-in'], label: 'HEAT Category' },
  ];
  const order: FinalizeStep[] = ['not-ready', 'team-ready', 'video', 'category', 'locking-in'];
  const currentIndex = order.indexOf(step);

  return (
    <div className="flex flex-col gap-1 w-full max-w-sm" data-testid="finalize-step-indicator">
      <div className="flex items-center gap-2">
        {segments.map((seg, i) => {
          const segIndex = order.indexOf(seg.key[seg.key.length - 1]!);
          const filled = currentIndex >= segIndex || seg.key.includes(step);
          return <div key={i} className={`flex-1 h-2 rounded-full border-2 border-ink ${filled ? 'bg-forest' : 'bg-white'}`} />;
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] font-black uppercase text-navy/50">
        {segments.map((seg) => (
          <span key={seg.label}>{seg.label}</span>
        ))}
      </div>
    </div>
  );
}

// heat-default.mp4 (v2) is a re-edit of the original template with its
// "(STARTUP)" placeholder removed at the source — the two moments it used to
// occupy are now genuinely blank space (verified by frame-sampling), not
// baked-in text to cover. An HTML overlay still fills the real team name into
// that blank space for exactly these windows (seconds), on whichever of the
// two the video is currently in (see useNamePlaceholderPhase) — the video
// plays untouched everywhere else. HEAT_CATEGORY_VIDEOS (the post-finalize
// per-category reveal) is a different, standalone set of clips as of v2 —
// each just plays its own "WELCOME OUR ___ HERO" directly with no shared
// template/placeholder — so this only applies to heat-default.mp4.
const GREETING_NAME_WINDOW = { start: 1.1, end: 3.5 } as const;
const SECTOR_NAME_WINDOW = { start: 22.6, end: 33.3 } as const;

type NamePlaceholderPhase = 'none' | 'greeting' | 'sector';

function phaseForVideoTime(t: number): NamePlaceholderPhase {
  if (t >= GREETING_NAME_WINDOW.start && t <= GREETING_NAME_WINDOW.end) return 'greeting';
  if (t >= SECTOR_NAME_WINDOW.start && t <= SECTOR_NAME_WINDOW.end) return 'sector';
  return 'none';
}

/** Tracks which of the two blank-space windows (if any) heat-default.mp4 is
 * currently in, off its own onTimeUpdate — see HeatCategoryVideoGate. */
function useNamePlaceholderPhase() {
  const [namePhase, setNamePhase] = useState<NamePlaceholderPhase>('none');
  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const phase = phaseForVideoTime(e.currentTarget.currentTime);
    setNamePhase((prev) => (prev === phase ? prev : phase));
  }
  return { namePhase, handleTimeUpdate };
}

/**
 * The real team name, drawn directly into the blank space heat-default.mp4
 * (v2) leaves for it — plain text in the same style as the video's own
 * surrounding lines ("GREETINGS!", "THE PHILIPPINES NEEDS YOU."), no
 * background patch: v2 has nothing baked in at these two moments anymore, so
 * there's nothing left to cover or risk double-exposing with.
 *
 * Anchored from a single fixed edge (`edge`/`anchor`) rather than vertically
 * centered: a longer team name that wraps to two lines must only grow AWAY
 * from that edge, into the blank space it was measured against, never back
 * toward the video's own neighboring (untouched) text on the other side —
 * "GREETINGS!" sits right above the first window, and "THE PHILIPPINES NEEDS
 * YOU." sits right below the second, so growing symmetrically around a
 * center point would risk eating into one or the other for a longer name.
 * `edge` is a plain percentage — safe to use directly (no letterboxing to
 * account for) because the wrapping video element is exactly a 9:16 box
 * (`aspect-[9/16] object-contain`), so container-relative percentages land on
 * the same spot as the source video's pixel percentages. Font size uses
 * container query width units (`cqw`) so it scales with the actual rendered
 * video box, not the viewport — the wrapper opts into that via
 * `[container-type:size]`.
 */
function NamePlaceholderOverlay({
  teamName,
  anchor,
  edge,
  underline,
  testId,
}: {
  teamName: string;
  anchor: 'top' | 'bottom';
  edge: string;
  underline?: boolean;
  testId: string;
}) {
  const displayName = teamName.trim() ? teamName.trim().toUpperCase() : 'YOUR STARTUP';
  return (
    <p
      className={`absolute left-1/2 -translate-x-1/2 max-w-[85%] font-black uppercase text-ink text-center leading-tight break-words ${underline ? 'underline decoration-4 underline-offset-4' : ''}`}
      style={{ [anchor]: edge, fontSize: 'clamp(12px, 8cqw, 32px)' }}
      data-testid={testId}
    >
      ({displayName})
    </p>
  );
}

/**
 * The CEO Name Selection -> HEAT Category Selection transition video —
 * plays automatically once the name timer closes, no user action required.
 * `onDone` fires on either onEnded or onError (a broken video should never
 * be able to permanently block a team from proceeding) and starts the HEAT
 * Category Selection timer server-side.
 */
function HeatCategoryVideoGate({ onDone, teamName }: { onDone: () => void; teamName: string }) {
  const [videoError, setVideoError] = useState(false);
  const { namePhase, handleTimeUpdate } = useNamePlaceholderPhase();

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-black uppercase text-forest mb-2 self-start">Get ready for HEAT Category Selection</p>
      <div className="relative w-full max-w-xs aspect-[9/16] rounded-xl border-[3px] border-ink shadow-[4px_4px_0px_#111111] bg-ink overflow-hidden [container-type:size]">
        <video
          className="w-full h-full object-contain"
          autoPlay
          controls
          controlsList="nodownload noplaybackrate"
          onEnded={onDone}
          onTimeUpdate={handleTimeUpdate}
          onError={() => {
            setVideoError(true);
            onDone();
          }}
          data-testid="heat-category-video"
        >
          <source src={HEAT_DEFAULT_VIDEO} type="video/mp4" />
        </video>

        {namePhase === 'greeting' && (
          // "GREETINGS!" ends at 48.3% of frame height; the blank space
          // below it runs on for a while, so this is just anchored a little
          // clear of that with room to grow downward for a longer name.
          <NamePlaceholderOverlay teamName={teamName} anchor="top" edge="50%" underline testId="heat-video-greeting-name" />
        )}
        {namePhase === 'sector' && (
          // "THE PHILIPPINES NEEDS YOU." now starts at 27.9% (v2 shifted
          // slightly from v1 after the placeholder line above it was
          // removed) — anchored from the bottom edge, fixed just clear of
          // that, so a longer name grows upward into the blank space toward
          // the top banner instead of down into that subtitle line.
          <NamePlaceholderOverlay teamName={teamName} anchor="bottom" edge="73%" testId="heat-video-sector-name" />
        )}
      </div>
      {videoError ? (
        <p className="text-xs font-bold text-crimson mt-2" data-testid="heat-category-video-error">
          Video unavailable right now — continuing anyway.
        </p>
      ) : (
        <p className="text-xs font-bold text-navy/60 mt-2">HEAT Category Selection starts automatically once this ends.</p>
      )}
    </div>
  );
}

/** Plays once the team is finalized, matching the HEAT category the CEO
 * selected — see HEAT_CATEGORY_VIDEOS. One real, standalone video per
 * category (brand kit provided; no re-encoding here) — each just plays its
 * own "WELCOME OUR ___ HERO" directly, with the category name already in
 * place, so unlike HeatCategoryVideoGate this needs no name overlay. Autoplay
 * muted (browsers block unmuted autoplay regardless) with controls, so it
 * plays immediately on reveal but the CEO can also unmute, pause, or replay
 * it afterward. */
function HeatCategoryRevealVideo({ category }: { category: HeatCategory }) {
  return (
    <div className="w-full max-w-xs aspect-[9/16] rounded-xl border-[3px] border-ink shadow-[4px_4px_0px_#111111] bg-ink overflow-hidden">
      <video className="w-full h-full object-contain" autoPlay muted controls playsInline data-testid="heat-category-reveal-video">
        <source src={HEAT_CATEGORY_VIDEOS[category]} type="video/mp4" />
      </video>
    </div>
  );
}

function FinalizedView({ team }: { team: Team }) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center" data-testid="finalize-success">
      {team.category && <HeatCategoryRevealVideo category={team.category} />}
      <Link to="/team" className={comicButton('crimson')}>
        OPEN TEAM HUB
      </Link>
    </div>
  );
}

/**
 * Buttonless, fully timer-driven CEO Name Selection -> HEAT Category
 * Selection flow. Every transition is a deadline the server already decided
 * (Team.nameSelectionEndsAt/categorySelectionEndsAt, both admin-configurable
 * via the Main Controller — see HackathonState.ceoNameSelectionSeconds/
 * heatCategorySelectionSeconds) — this page only ever DERIVES which panel to
 * show from those deadlines plus a locally-ticking clock (useTickingNow), it
 * never decides on its own that a step is "done." That's what makes a page
 * refresh mid-countdown safe: the same deadlines come back from the server
 * and the same step gets derived again, and it's also what makes the timer
 * unbypassable from the frontend — the name input and category buttons are
 * just autosave affordances (useSaveFinalizeDraft); the server independently
 * rejects either write once its own step's window has closed.
 */
export function CeoFinalizePage() {
  const { data: status, isLoading, error, refetch } = useFinalizationStatus();
  const saveDraft = useSaveFinalizeDraft();
  const startCategoryTimer = useStartCategoryTimer();

  const [name, setName] = useState('');
  const nameSeededRef = useRef(false);
  const videoDoneRef = useRef(false);
  // Optimistic-only: the category ring highlight was driven purely by
  // `status.team.category`, i.e. the server's OWN echo of the save — so a
  // tap produced zero visible feedback until that full round trip completed,
  // reading as "nothing happened" on anything slower than an instant
  // connection. Shows the tapped category immediately; once its save
  // settles (success or failure), falls back to the authoritative
  // `status.team.category` either way — but only if THIS tap is still the
  // most recent one, so a fast second tap while the first is still in
  // flight doesn't have its own optimistic state clobbered by the first
  // one's late-arriving response.
  const [pendingCategory, setPendingCategory] = useState<HeatCategory | null>(null);

  const nowMs = useTickingNow(status?.serverNow);
  const nameEndsAtMs = status?.nameSelectionEndsAt ? new Date(status.nameSelectionEndsAt).getTime() : null;
  const categoryEndsAtMs = status?.categorySelectionEndsAt ? new Date(status.categorySelectionEndsAt).getTime() : null;

  const step: FinalizeStep = !nameEndsAtMs
    ? 'not-ready'
    : nowMs < nameEndsAtMs
      ? 'team-ready'
      : !categoryEndsAtMs
        ? 'video'
        : nowMs < categoryEndsAtMs
          ? 'category'
          : 'locking-in';

  // Seed the name input from the server exactly once (the first time the
  // team-ready step is actually shown) — never again afterward, so the
  // server's own echo of what we just saved can't clobber a keystroke.
  useEffect(() => {
    if (step === 'team-ready' && !nameSeededRef.current && status) {
      setName(status.team.name ?? '');
      nameSeededRef.current = true;
    }
  }, [step, status]);

  // Debounced autosave — the buttonless replacement for "type a name, click
  // Continue." Only while the name step is actually open server-side.
  useEffect(() => {
    if (step !== 'team-ready' || !nameSeededRef.current) return;
    const timer = setTimeout(() => {
      const trimmed = name.trim();
      if (trimmed !== (status?.team.name ?? '')) {
        saveDraft.mutate({ name: trimmed });
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, step]);

  // Flush any not-yet-autosaved name the instant the countdown crosses zero
  // — the debounced save above waits up to 600ms after the last keystroke
  // before firing at all, which can still be pending right as `step` flips
  // away from 'team-ready' (that flip is purely time-based, synchronous, and
  // doesn't wait for this). The "Get Ready" video that plays next starts
  // immediately and shows the team name within about a second, so a save
  // still in its debounce window at that exact instant can genuinely lose
  // the race and show the placeholder for a team that DID type a name. This
  // doesn't block or delay the step transition itself (nothing here touches
  // `step`) — it just gets the save request out the door as early as
  // possible instead of waiting on a keystroke pause first, shrinking that
  // window as much as a synchronous step machine allows without a real
  // network round trip in the way (see git history for why an earlier,
  // stricter attempt at fully closing this — gating `step` on a fresh
  // refetch landing — was reverted: it broke every test asserting the step
  // machine synchronously).
  const nameFlushedRef = useRef(false);
  useEffect(() => {
    nameFlushedRef.current = false;
  }, [nameEndsAtMs]);
  useEffect(() => {
    if (nameEndsAtMs === null || nowMs < nameEndsAtMs || nameFlushedRef.current || !nameSeededRef.current) return;
    nameFlushedRef.current = true;
    const trimmed = name.trim();
    if (trimmed !== (status?.team.name ?? '')) {
      saveDraft.mutate({ name: trimmed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, nameEndsAtMs]);

  // The instant either countdown reaches 0 client-side, refetch immediately
  // rather than waiting for the next 2s poll — getFinalizationStatus does
  // the actual server-side transition/self-heal synchronously on read, so
  // this is what makes the UI advance right away instead of lagging.
  function handleExpire() {
    void refetch();
  }

  function handleVideoDone() {
    if (videoDoneRef.current) return; // guards against onEnded firing twice, or after onError already did
    videoDoneRef.current = true;
    startCategoryTimer.mutate();
  }

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !status) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  if (status.team.finalizedAt) {
    return <FinalizedView team={status.team} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center w-full max-w-sm mx-auto" data-testid="ceo-finalize-page">
      <StepIndicator step={step} />

      {step === 'not-ready' && (
        <section className="comic-panel w-full p-6" data-testid="not-ready-step">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
          <h2 className={`text-2xl mt-1 ${comicHeading}`}>Team Ready</h2>
          <p className="text-crimson font-black mt-1 uppercase text-sm" data-testid="finalize-member-count">
            {status.memberCount} / 5 MEMBERS
          </p>

          <div className="grid grid-cols-5 gap-2 text-sm mt-4">
            {ALL_DEPARTMENTS.map((dept) => (
              <div key={dept} className={status.departmentComplete[dept] ? 'text-forest font-black' : 'text-navy/30 font-bold'}>
                {status.departmentComplete[dept] ? '✓' : '—'} {dept}
              </div>
            ))}
          </div>

          {status.allowIncompleteTeams && (
            <p className="text-xs font-bold text-forest max-w-sm mx-auto mt-3">
              Recruitment is short on participants today — teams may finalize with fewer than 5 members.
            </p>
          )}

          {!status.canFinalize && status.reason && (
            <p className="text-sm font-bold text-navy max-w-sm mx-auto mt-3" data-testid="finalize-not-ready">
              {status.reason === 'TEAM_NOT_COMPLETE'
                ? status.allowIncompleteTeams
                  ? 'Recruit at least one member to start your CEO Name Selection timer.'
                  : 'Recruit the remaining departments to start your CEO Name Selection timer.'
                : `Finalization isn't available right now (${status.reason}).`}
            </p>
          )}

          {/* A freshly-promoted CEO lands directly on THIS page now (see
              ParticipantChallengePage's post-congratulations auto-redirect) —
              this page no longer routes through CeoDashboardPage first, so
              this is the only way to actually reach the QR scanner from here. */}
          {status.reason === 'TEAM_NOT_COMPLETE' && (
            <Link to="/ceo/recruit" className={`mt-4 ${comicButton('crimson')}`} data-testid="not-ready-scan-member-link">
              SCAN MEMBER
            </Link>
          )}
        </section>
      )}

      {step === 'team-ready' && nameEndsAtMs && (
        <section className="comic-panel w-full p-6" data-testid="team-ready-step">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-widest text-forest">CEO Name Selection</p>
          <h2 className={`text-2xl mt-1 ${comicHeading}`}>Name Your Team</h2>

          <div className="mt-3" data-testid="name-selection-timer">
            <CountdownTimer endsAt={status.nameSelectionEndsAt!} serverNow={status.serverNow} onExpire={handleExpire} />
          </div>

          <div className="w-full text-left mt-5">
            <label htmlFor="team-name" className="text-xs font-black uppercase text-forest">
              Team Name
            </label>
            <input
              id="team-name"
              autoFocus
              data-testid="team-name-input"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-ink font-bold focus:outline-none focus:ring-2 focus:ring-crimson"
            />
            <p className="mt-1.5 text-[11px] font-bold text-crimson flex items-center gap-1" data-testid="team-name-caution">
              <span aria-hidden="true">⚠</span> Choose carefully — your team name is permanent and can&apos;t be changed once the
              timer runs out. Leave it blank and one will be generated for you.
            </p>
            {saveDraft.isError && (
              <p className="mt-1.5 text-[11px] font-bold text-crimson" data-testid="draft-save-error">
                {getApiErrorMessage(saveDraft.error)}
              </p>
            )}
          </div>
        </section>
      )}

      {step === 'video' && (
        <section className="comic-panel w-full p-6" data-testid="video-step">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
          <h2 className={`text-2xl mt-1 mb-4 ${comicHeading}`}>Get Ready</h2>
          <HeatCategoryVideoGate onDone={handleVideoDone} teamName={status.team.name ?? ''} />
        </section>
      )}

      {step === 'category' && categoryEndsAtMs && (
        <section className="comic-panel w-full p-6" data-testid="category-step">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-widest text-forest">HEAT Category Selection</p>
          <h2 className={`text-2xl mt-1 ${comicHeading}`}>Select HEAT Category</h2>
          <p className="text-navy/60 text-xs font-bold mt-1 mb-2">{status.team.name}</p>

          <div data-testid="category-selection-timer">
            <CountdownTimer endsAt={status.categorySelectionEndsAt!} serverNow={status.serverNow} onExpire={handleExpire} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {status.categories.map((c) => (
              <button
                key={c.category}
                data-testid={`category-button-${c.category}`}
                disabled={c.full}
                onClick={() => {
                  setPendingCategory(c.category);
                  saveDraft.mutate(
                    { category: c.category },
                    { onSettled: () => setPendingCategory((prev) => (prev === c.category ? null : prev)) },
                  );
                }}
                className="flex flex-col items-center gap-1.5 transition-transform duration-100 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <img
                  src={HEAT_CATEGORY_ICONS[c.category]}
                  alt={CATEGORY_LABELS[c.category]}
                  className={`w-32 h-32 object-contain rounded-2xl transition-shadow ${
                    (pendingCategory ?? status.team.category) === c.category ? 'ring-4 ring-crimson' : ''
                  }`}
                  data-testid={`category-icon-${c.category}`}
                />
                <p className="text-xs font-bold text-navy/60">
                  {c.used} / {c.capacity}
                  {c.full ? ' · FULL' : ''}
                </p>
              </button>
            ))}
          </div>

          <p className="text-xs font-bold text-navy/60 mt-4">
            {(pendingCategory ?? status.team.category)
              ? `${CATEGORY_LABELS[(pendingCategory ?? status.team.category)!]} selected — locks in automatically when the timer ends.`
              : "Pick a category before the timer ends, or one will be chosen for you."}
          </p>

          {saveDraft.isError && (
            <p className="text-crimson font-bold text-sm mt-3" data-testid="draft-save-error">
              {getApiErrorMessage(saveDraft.error)}
            </p>
          )}
        </section>
      )}

      {step === 'locking-in' && (
        <div className="text-center" data-testid="locking-in">
          <p className="text-ink font-black">Locking in your team…</p>
        </div>
      )}
    </div>
  );
}
