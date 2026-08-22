import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { useFinalizationStatus, useFinalizeTeam } from '../../hooks/useFinalization';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';
import { HEAT_CATEGORY_ICONS, HEAT_CATEGORY_VIDEOS, HEAT_DEFAULT_VIDEO } from '../../lib/heatCategoryAssets';
import { ALL_DEPARTMENTS, type HeatCategory, type Team } from '../../types/api';

const CATEGORY_LABELS: Record<HeatCategory, string> = {
  HEALTH: 'HEALTH',
  EDUCATION: 'EDUCATION',
  AGRICULTURE: 'AGRICULTURE',
  TOURISM: 'TOURISM',
};

type FinalizeStep = 'team-ready' | 'category';

/** Two-dot progress line above both step cards — purely visual, reinforcing
 * that this is a 2-step flow rather than one long form. */
function StepIndicator({ step }: { step: FinalizeStep }) {
  return (
    <div className="flex items-center gap-2 w-full max-w-sm" data-testid="finalize-step-indicator">
      <div className="flex-1 h-2 rounded-full border-2 border-ink bg-forest" />
      <div className={`flex-1 h-2 rounded-full border-2 border-ink ${step === 'category' ? 'bg-forest' : 'bg-white'}`} />
    </div>
  );
}

/**
 * Gates HEAT category selection behind a required briefing video — the CEO
 * must watch it start to finish (`onEnded`) before `onWatched` reveals the
 * category picker; there's deliberately no skip button. Uses the brand kit's
 * catch-all clip (see HEAT_DEFAULT_VIDEO) since this plays before a category
 * is even chosen, so there's nothing category-specific to show yet. If that
 * file is genuinely missing/broken (e.g. a bad deploy), `onError` still
 * offers a "Continue anyway" escape hatch — a broken video should never be
 * able to permanently block every team in the event from finalizing.
 */
function HeatCategoryVideoGate({ onWatched }: { onWatched: () => void }) {
  const [videoError, setVideoError] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-black uppercase text-forest mb-2 self-start">Watch before selecting your category</p>
      <div className="w-full max-w-xs aspect-[9/16] rounded-xl border-[3px] border-ink shadow-[4px_4px_0px_#111111] bg-ink overflow-hidden">
        <video
          className="w-full h-full object-contain"
          controls
          controlsList="nodownload noplaybackrate"
          onEnded={onWatched}
          onError={() => setVideoError(true)}
          data-testid="heat-category-video"
        >
          <source src={HEAT_DEFAULT_VIDEO} type="video/mp4" />
        </video>
      </div>
      {videoError ? (
        <div className="w-full max-w-xs mt-2 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-bold text-crimson" data-testid="heat-category-video-error">
            Video unavailable right now.
          </p>
          <button onClick={onWatched} className={comicButton('white', 'xs')}>
            Continue anyway
          </button>
        </div>
      ) : (
        <p className="text-xs font-bold text-navy/60 mt-2">Category selection unlocks once the video finishes.</p>
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
 * Backend is authoritative for every rule here (composition, name
 * uniqueness, category capacity) — this page's own checks (disabling a full
 * category, requiring a name before enabling the button) are UX only. The
 * atomic finalize transaction re-verifies everything from scratch and can
 * still reject a state this page just showed as "ready."
 *
 * The form itself is split into two visually distinct steps — Team Ready,
 * then Select HEAT Category — purely as a UI/UX organization; nothing about
 * what's required to finalize changed, just how it's presented. `step` is
 * local view state only, not persisted, and going back to step 1 doesn't
 * discard anything already chosen in step 2 (video-watched, category).
 */
export function CeoFinalizePage() {
  const { data: status, isLoading, error, refetch } = useFinalizationStatus();
  const finalizeTeam = useFinalizeTeam();
  const [step, setStep] = useState<FinalizeStep>('team-ready');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HeatCategory | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !status) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  if (status.team.finalizedAt) {
    return <FinalizedView team={status.team} />;
  }

  if (finalizeTeam.isSuccess) {
    return <FinalizedView team={finalizeTeam.data} />;
  }

  const trimmedName = name.trim();
  const canContinueToCategory = status.canFinalize && trimmedName.length > 0;
  const canSubmit = canContinueToCategory && category !== null && videoWatched;

  function goToCategoryStep() {
    if (!canContinueToCategory) return;
    setStep('category');
  }

  function backToTeamReady() {
    setStep('team-ready');
  }

  function openConfirm() {
    if (!canSubmit) return;
    setConfirming(true);
  }

  function cancelConfirm() {
    setConfirming(false);
  }

  function confirmFinalize() {
    if (!category) return;
    setConfirming(false);
    finalizeTeam.mutate({ name: trimmedName, category });
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center w-full max-w-sm mx-auto" data-testid="ceo-finalize-page">
      <StepIndicator step={step} />

      {step === 'team-ready' && (
        <section className="comic-panel w-full p-6" data-testid="team-ready-step">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-widest text-forest">Step 1 of 2</p>
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
                  ? 'Recruit at least one member before finalizing.'
                  : 'Recruit the remaining departments before finalizing.'
                : `Finalization isn't available right now (${status.reason}).`}
            </p>
          )}

          <div className="w-full text-left mt-5">
            <label htmlFor="team-name" className="text-xs font-black uppercase text-forest">
              Team Name
            </label>
            <input
              id="team-name"
              data-testid="team-name-input"
              value={name}
              maxLength={80}
              disabled={!status.canFinalize}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-ink font-bold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-crimson"
            />
            <p className="mt-1.5 text-[11px] font-bold text-crimson flex items-center gap-1" data-testid="team-name-caution">
              <span aria-hidden="true">⚠</span> Choose carefully — your team name is permanent and can&apos;t be changed once finalized.
            </p>
          </div>

          <button
            data-testid="continue-to-category-button"
            disabled={!canContinueToCategory}
            onClick={goToCategoryStep}
            className={`mt-6 w-full ${comicButton('crimson')}`}
          >
            Continue to HEAT Selection →
          </button>
        </section>
      )}

      {step === 'category' && (
        <section className="comic-panel w-full p-6" data-testid="category-step">
          <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              data-testid="back-to-team-ready-button"
              onClick={backToTeamReady}
              className="text-xs font-black uppercase text-forest hover:text-crimson transition"
            >
              ← Team Ready
            </button>
            <p className="text-xs font-black uppercase tracking-widest text-forest">Step 2 of 2</p>
          </div>
          <h2 className={`text-2xl mt-1 ${comicHeading}`}>Select HEAT Category</h2>
          <p className="text-navy/60 text-xs font-bold mt-1 mb-4">{trimmedName}</p>

          {!videoWatched ? (
            <HeatCategoryVideoGate onWatched={() => setVideoWatched(true)} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {status.categories.map((c) => (
                <button
                  key={c.category}
                  data-testid={`category-button-${c.category}`}
                  disabled={c.full || !status.canFinalize}
                  onClick={() => setCategory(c.category)}
                  className="flex flex-col items-center gap-1.5 transition-transform duration-100 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <img
                    src={HEAT_CATEGORY_ICONS[c.category]}
                    alt={CATEGORY_LABELS[c.category]}
                    className={`w-32 h-32 object-contain rounded-2xl transition-shadow ${
                      category === c.category ? 'ring-4 ring-crimson' : ''
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
          )}

          <button
            data-testid="finalize-team-button"
            disabled={!canSubmit}
            onClick={openConfirm}
            className={`mt-6 w-full ${comicButton('crimson')}`}
          >
            FINALIZE TEAM
          </button>

          {finalizeTeam.isError && (
            <p className="text-crimson font-bold text-sm mt-3" data-testid="finalize-error">
              {getApiErrorCode(finalizeTeam.error)}: {getApiErrorMessage(finalizeTeam.error)}
            </p>
          )}
        </section>
      )}

      {confirming && category && (
        <div className="fixed inset-0 bg-ink/70 flex items-center justify-center p-4 z-10" data-testid="finalize-confirm-dialog">
          <div className="bg-white border-[3px] border-ink rounded-xl p-6 max-w-sm flex flex-col items-center gap-3 text-center shadow-[8px_8px_0px_#111111]">
            <p className="text-ink font-black uppercase">FINALIZE TEAM?</p>
            <div className="text-sm">
              <p className="text-forest text-xs uppercase font-black">Team</p>
              <p className="text-ink font-black">{trimmedName}</p>
            </div>
            <div className="text-sm">
              <p className="text-forest text-xs uppercase font-black">Category</p>
              <p className="text-ink font-black">{CATEGORY_LABELS[category]}</p>
            </div>
            <div className="text-sm">
              <p className="text-forest text-xs uppercase font-black">Members</p>
              <p className="text-ink font-black">{status.memberCount} / 5</p>
            </div>
            <p className="text-navy/60 text-xs">Once finalized, normal recruitment will be closed.</p>
            <p className="text-crimson text-xs font-bold">⚠ Your team name can&apos;t be changed after this.</p>
            <div className="flex gap-3 mt-1">
              <button data-testid="cancel-finalize-button" onClick={cancelConfirm} className={comicButton('white', 'sm')}>
                CANCEL
              </button>
              <button data-testid="confirm-finalize-button" disabled={finalizeTeam.isPending} onClick={confirmFinalize} className={comicButton('crimson', 'sm')}>
                FINALIZE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
