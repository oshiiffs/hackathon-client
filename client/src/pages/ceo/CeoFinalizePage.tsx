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

// heat-default.mp4 (1080x1920, 43.6s) has the literal placeholder text
// "(STARTUP)" baked into its own pixels at two moments — it's a real
// pre-rendered clip, not a template, so there's no way to substitute the
// team's actual name inside the video itself. These windows (seconds) were
// measured by frame-sampling the clip: [start, end] of each moment the
// placeholder is on screen, with a little padding on either side to fully
// cover its fade in/out. An HTML overlay (see NamePlaceholderOverlay below)
// swaps in the real team name for exactly these windows; the video plays
// untouched everywhere else, including its own separate "(SECTOR)" placeholder
// later on — that one is intentionally left alone here, since the real
// per-category reveal happens on a completely different, already-correct
// video (see HEAT_CATEGORY_VIDEOS / HeatCategoryRevealVideo below).
const GREETING_NAME_WINDOW = { start: 1.1, end: 3.5 } as const;
const SECTOR_NAME_WINDOW = { start: 22.6, end: 33.3 } as const;

type NamePlaceholderPhase = 'none' | 'greeting' | 'sector';

function phaseForVideoTime(t: number): NamePlaceholderPhase {
  if (t >= GREETING_NAME_WINDOW.start && t <= GREETING_NAME_WINDOW.end) return 'greeting';
  if (t >= SECTOR_NAME_WINDOW.start && t <= SECTOR_NAME_WINDOW.end) return 'sector';
  return 'none';
}

/**
 * An opaque comic-caption patch (matching the app's existing button/panel
 * language — white fill, thick ink border, hard offset shadow) placed over
 * wherever heat-default.mp4 shows its own baked "(STARTUP)" text, sized/
 * positioned from the same frame-sampling as the time windows above. Opaque
 * on purpose: the video's own placeholder text sits directly underneath, and
 * only a fully-covering patch guarantees it never shows through or
 * double-exposes with the real name drawn on top of it.
 *
 * `top`/`underline` were read off the sampled frames (percentages of the
 * video's own 1080x1920 frame) — safe to position as plain percentages here
 * because the wrapping video element is exactly a 9:16 box (`aspect-[9/16]
 * object-contain`), so container-relative percentages land on the same spot
 * as the source video's pixel percentages, with no letterboxing to account
 * for. Font size uses container query width units (`cqw`) so it scales with
 * the actual rendered video box, not the viewport — the wrapper opts into
 * that via `[container-type:size]`.
 */
function NamePlaceholderOverlay({
  teamName,
  top,
  minHeightCqh,
  underline,
  testId,
}: {
  teamName: string;
  top: string;
  minHeightCqh: number;
  underline?: boolean;
  testId: string;
}) {
  const displayName = teamName.trim() ? teamName.trim().toUpperCase() : 'YOUR STARTUP';
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center max-w-[85%] px-4 rounded-lg border-[3px] border-ink bg-white shadow-[3px_3px_0px_#111111]"
      // A percentage-of-container minHeight (rather than relying on padding
      // alone) is what guarantees this patch is always at least as tall as
      // the video's own baked placeholder text at this exact moment —
      // measured per-call below — regardless of how the real team name's
      // length/wrapping changes the natural height of the text inside it;
      // padding alone could come up short and leave the original text's
      // underline/descenders peeking out past this patch's edge. Tuned
      // per-window (not a shared constant) since the two moments have very
      // different vertical clearance before the next line of the video's own
      // (untouched) text — see the two call sites below.
      style={{ top, minHeight: `clamp(24px, ${minHeightCqh}cqh, 64px)` }}
      data-testid={testId}
    >
      <p
        className={`font-black uppercase text-ink text-center leading-tight break-words py-1 ${underline ? 'underline decoration-4 underline-offset-4' : ''}`}
        style={{ fontSize: 'clamp(12px, 8cqw, 32px)' }}
      >
        ({displayName})
      </p>
    </div>
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
  const [namePhase, setNamePhase] = useState<NamePlaceholderPhase>('none');

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
          onTimeUpdate={(e) => {
            const phase = phaseForVideoTime(e.currentTarget.currentTime);
            setNamePhase((prev) => (prev === phase ? prev : phase));
          }}
          onError={() => {
            setVideoError(true);
            onDone();
          }}
          data-testid="heat-category-video"
        >
          <source src={HEAT_DEFAULT_VIDEO} type="video/mp4" />
        </video>

        {namePhase === 'greeting' && (
          // Measured "(STARTUP)" span (letters + parens + underline flourish):
          // top 52.1%, bottom 59.7% of frame — an 11cqh box centered at 56%
          // (50.5%-61.5%) comfortably covers all of it, with "GREETINGS!"
          // (ends 48.3%) still clear above and nothing below to collide with.
          <NamePlaceholderOverlay teamName={teamName} top="56%" minHeightCqh={11} underline testId="heat-video-greeting-name" />
        )}
        {namePhase === 'sector' && (
          // Measured "(STARTUP)" span: top 20.2%, bottom 25.5% of frame — the
          // "THE PHILIPPINES NEEDS YOU." subtitle starts right at 25.5%, so
          // this window is tighter: a 6cqh box centered at 22.5% (19.5%-25.5%)
          // covers the placeholder without eating into that next line.
          <NamePlaceholderOverlay teamName={teamName} top="22.5%" minHeightCqh={6} testId="heat-video-sector-name" />
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
 * selected — see HEAT_CATEGORY_VIDEOS. Not a shared/generic clip: each of
 * the four categories has its own real video (brand kit provided; no
 * re-encoding here). Autoplay muted (browsers block unmuted autoplay
 * regardless) with controls, so it plays immediately on reveal but the CEO
 * can also unmute, pause, or replay it afterward. */
function HeatCategoryRevealVideo({ category }: { category: HeatCategory }) {
  return (
    <div className="w-full max-w-xs aspect-[9/16] rounded-xl border-[3px] border-ink shadow-[4px_4px_0px_#111111] bg-ink overflow-hidden">
      <video
        className="w-full h-full object-contain"
        autoPlay
        muted
        controls
        playsInline
        data-testid="heat-category-reveal-video"
      >
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
                onClick={() => saveDraft.mutate({ category: c.category })}
                className="flex flex-col items-center gap-1.5 transition-transform duration-100 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <img
                  src={HEAT_CATEGORY_ICONS[c.category]}
                  alt={CATEGORY_LABELS[c.category]}
                  className={`w-32 h-32 object-contain rounded-2xl transition-shadow ${
                    status.team.category === c.category ? 'ring-4 ring-crimson' : ''
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
            {status.team.category
              ? `${CATEGORY_LABELS[status.team.category]} selected — locks in automatically when the timer ends.`
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
