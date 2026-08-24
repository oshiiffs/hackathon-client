import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackground } from '../../components/AmbientBackground';
import { CountdownTimer } from '../../components/CountdownTimer';
import { useSyncedTopic } from '../../hooks/useSyncedTopic';
import {
  useAdminDeliverables,
  useAdminEvaluations,
  useAdminHackathonState,
  useAdminLeaderboard,
  useAdminOverview,
  useAdminParticipants,
  useCeoChallengeLeaderboard,
  useCeoQuestions,
  useLiveAnswerAggregate,
} from '../../hooks/useAdmin';
import { getSocket } from '../../lib/socket';
import { comicButton } from '../../lib/comic';
import { DEPARTMENT_COLORS } from '../../lib/departmentColors';
import { HEAT_CATEGORY_ICONS, HEAT_DEFAULT_VIDEO } from '../../lib/heatCategoryAssets';
import type {
  AdminEvaluationOverview,
  CategoryUsage,
  Department,
  CeoChallengeLeaderboardEntry,
  HackathonPhase,
  HeatCategory,
  LeaderboardEntry,
  TeamDeliverableStatus,
} from '../../types/api';
import type { ChallengeAnswerSubmittedPayload, ChallengeEndPayload } from '../../types/realtime';

const HEAT_CATEGORY_ORDER: HeatCategory[] = ['HEALTH', 'ENVIRONMENT', 'AGRICULTURE', 'TOURISM'];

type ManualScreen = 'auto' | 'recruiting' | 'welcome' | 'category' | 'ceo-leaderboard';

const MANUAL_SCREENS: { id: ManualScreen; label: string }[] = [
  { id: 'auto', label: 'Live (auto)' },
  { id: 'recruiting', label: 'Scanning members' },
  { id: 'welcome', label: 'Welcome video' },
  { id: 'category', label: 'Category selection' },
  { id: 'ceo-leaderboard', label: 'CEO Challenge leaderboard' },
];

/**
 * The big-screen/LCD view for competition day — cast this tab, not the admin
 * dashboard. "Live (auto)" follows the event's own phase end to end (see
 * renderAutoScreen below for the full LOBBY -> CEO_CHALLENGE_ACTIVE ->
 * DRAFTING -> SUBMISSIONS_OPEN -> SUBMISSIONS_LOCKED -> JUDGING -> COMPLETE
 * mapping) — normally the operator never needs to touch anything, since
 * whatever's actually happening is what's on screen. The strip at the bottom
 * is a manual OVERRIDE for the two moments that aren't tied to a single
 * phase (a welcome video played at a moment of the operator's choosing, and
 * the category board being useful to leave up across both DRAFTING and
 * SUBMISSIONS), not something that needs to be driven every step.
 *
 * Each phase's own data query is only enabled while that phase (or its
 * matching manual override) is actually on screen — this page can sit
 * mounted on a projector for an entire multi-hour event, so polling every
 * phase's data unconditionally the whole time would mean paying for CEO
 * Challenge roster fetches during JUDGING, evaluation polls during LOBBY,
 * etc. for no reason.
 */
export function PresenterPage() {
  const { data: state } = useAdminHackathonState();
  const phase = state?.phase;

  const [manualScreen, setManualScreen] = useState<ManualScreen>('auto');
  const [answeredByQuestion, setAnsweredByQuestion] = useState<Record<string, Map<string, string>>>({});
  const [lastWinners, setLastWinners] = useState<ChallengeEndPayload['winners'] | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  const questions = useCeoQuestions(phase === 'CEO_CHALLENGE_ACTIVE');
  const participants = useAdminParticipants(
    manualScreen === 'recruiting' || (manualScreen === 'auto' && (phase === 'CEO_CHALLENGE_ACTIVE' || phase === 'DRAFTING')),
  );
  const overview = useAdminOverview(manualScreen === 'category');
  const deliverables = useAdminDeliverables(
    manualScreen === 'auto' && (phase === 'SUBMISSIONS_OPEN' || phase === 'SUBMISSIONS_LOCKED'),
  );
  const evaluations = useAdminEvaluations(manualScreen === 'auto' && (phase === 'JUDGING' || phase === 'COMPLETE'));
  const leaderboard = useAdminLeaderboard(manualScreen === 'auto' && (phase === 'JUDGING' || phase === 'COMPLETE'));
  const ceoChallengeLeaderboard = useCeoChallengeLeaderboard(manualScreen === 'ceo-leaderboard');

  const activeQuestions = (questions.data ?? [])
    .filter((q) => q.isActive)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const { topicIndex, answerEndsAtMs, roundOver, serverNowIso } = useSyncedTopic(
    state?.challengeStartedAt,
    state?.challengeDurationSeconds ?? 30,
    state?.serverNow,
    activeQuestions.length,
  );
  const currentQuestion = activeQuestions[topicIndex];
  const roundActive = state?.phase === 'CEO_CHALLENGE_ACTIVE' && !roundOver;

  // 15s recap of the topic that just ended, overlaid on the next topic —
  // see the module doc comment for why it's a non-blocking overlay rather
  // than a real pause between topics.
  //
  // `prevTopicIndexRef` MUST be advanced to the current `topicIndex` on
  // every run of this effect, unconditionally, before anything below can
  // early-return — the recap branch does exactly that (`return () =>
  // clearTimeout(timer)`, the effect's own cleanup function). Advancing the
  // ref only in the fallthrough path at the bottom (as this used to) meant
  // that return skipped it every single time a recap actually fired, so
  // after the very first topic transition the ref was permanently stuck at
  // topic 0 — every later transition kept computing `endedQuestion` from
  // that same stale index, showing topic 1's recap forever instead of
  // advancing through each topic's own.
  const prevTopicIndexRef = useRef<number | null>(null);
  const [recapQuestionId, setRecapQuestionId] = useState<string | null>(null);
  useEffect(() => {
    if (!roundActive) return;
    const endedTopicIndex = prevTopicIndexRef.current;
    prevTopicIndexRef.current = topicIndex;
    if (endedTopicIndex !== null && endedTopicIndex !== topicIndex) {
      const endedQuestion = activeQuestions[endedTopicIndex];
      if (endedQuestion) {
        setRecapQuestionId(endedQuestion.id);
        const timer = setTimeout(() => setRecapQuestionId(null), 15000);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex, roundActive]);
  const recapAggregate = useLiveAnswerAggregate(recapQuestionId, recapQuestionId !== null);

  // Live "who's answered" board — admin-room-only socket event (never sent
  // to participants), see backend events.ts's CHALLENGE_ANSWER_SUBMITTED.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAnswer = (payload: ChallengeAnswerSubmittedPayload) => {
      setAnsweredByQuestion((prev) => {
        const next = { ...prev };
        const forQuestion = new Map(next[payload.questionId] ?? []);
        forQuestion.set(payload.userId, payload.fullName);
        next[payload.questionId] = forQuestion;
        return next;
      });
    };
    const onEnd = (payload: ChallengeEndPayload) => {
      setLastWinners(payload.winners);
      setShowReveal(true);
    };
    socket.on('challenge:answer-submitted', onAnswer);
    socket.on('challenge:end', onEnd);
    return () => {
      socket.off('challenge:answer-submitted', onAnswer);
      socket.off('challenge:end', onEnd);
    };
  }, []);

  const roster = (participants.data ?? []).filter((p) => p.role === 'PARTICIPANT' && !p.drafted);
  const answeredNow = currentQuestion ? (answeredByQuestion[currentQuestion.id] ?? new Map()) : new Map();

  // "Live (auto)" — one screen per hackathon phase, so the operator never has
  // to touch the manual override strip during normal running. A winners
  // reveal always takes priority over whatever the phase itself would show
  // (it's a brief, self-dismissing overlay moment triggered by the CEO
  // Challenge round actually ending, not a phase of its own).
  function renderAutoScreen() {
    if (showReveal && lastWinners) {
      return <RevealScreen winners={lastWinners} onDone={() => setShowReveal(false)} />;
    }

    switch (phase as HackathonPhase | undefined) {
      case 'CEO_CHALLENGE_ACTIVE':
        if (roundActive && currentQuestion && answerEndsAtMs > 0) {
          return (
            <div className="w-full max-w-5xl flex flex-col items-center gap-8">
              <p className="text-lg font-black uppercase tracking-widest text-crimson">
                Topic {topicIndex + 1} of {activeQuestions.length}
              </p>
              <CountdownTimer endsAt={new Date(answerEndsAtMs).toISOString()} serverNow={serverNowIso} />
              <h1 className="text-5xl font-black text-center tracking-tight text-ink">{currentQuestion.question}</h1>

              <div className="w-full grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-4">
                {roster.map((p) => {
                  const lit = answeredNow.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg px-2 py-2 text-center text-xs font-bold truncate border-[3px] transition-all duration-300 ${
                        lit
                          ? 'bg-forest text-cream border-ink scale-105 shadow-[3px_3px_0px_#111111]'
                          : 'bg-white border-ink text-navy/40'
                      }`}
                    >
                      {p.fullName}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm font-bold text-navy">
                {answeredNow.size} / {roster.length} answered
              </p>

              {recapQuestionId && <TopAnswersOverlay aggregate={recapAggregate.data} isLoading={recapAggregate.isLoading} />}
            </div>
          );
        }
        // Between rounds (challenge active but this round already ended and
        // the next hasn't started) — same idle treatment as LOBBY.
        return <IdleScreen />;

      case 'DRAFTING':
        return <ScanningMembersScreen participants={participants.data ?? []} />;

      case 'SUBMISSIONS_OPEN':
        return <SubmissionsScreen deliverables={deliverables.data ?? []} open />;

      case 'SUBMISSIONS_LOCKED':
        return <SubmissionsScreen deliverables={deliverables.data ?? []} open={false} />;

      case 'JUDGING':
        return <JudgingScreen evaluations={evaluations.data ?? []} leaderboard={leaderboard.data ?? []} />;

      case 'COMPLETE':
        return <CompleteScreen leaderboard={leaderboard.data ?? []} />;

      case 'LOBBY':
      default:
        return <IdleScreen />;
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col isolate">
      <AmbientBackground />
      <div className="flex items-center justify-between px-6 py-3 border-b-[3px] border-ink bg-white">
        <div className="flex items-center gap-2">
          <img src="/nexus-icon-v2.png" alt="" className="w-7 h-7 rounded-md border-[3px] border-ink" />
          <Link to="/admin/dashboard" className="text-xs font-black uppercase text-navy hover:text-crimson transition">
            ← Exit presenter view
          </Link>
        </div>
        <div className="flex gap-1.5">
          {MANUAL_SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => setManualScreen(s.id)}
              className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg border-[3px] transition-transform duration-100 hover:translate-x-0.5 hover:translate-y-0.5 ${
                manualScreen === s.id
                  ? 'bg-crimson text-ink border-ink shadow-[3px_3px_0px_#111111]'
                  : 'bg-white text-navy border-ink hover:bg-cream'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        {manualScreen === 'recruiting' && <ScanningMembersScreen participants={participants.data ?? []} />}
        {manualScreen === 'welcome' && <WelcomeScreen />}
        {manualScreen === 'category' && <CategorySelectionScreen categoryUsage={overview.data?.categoryUsage ?? []} />}
        {manualScreen === 'ceo-leaderboard' && <CeoChallengeLeaderboardScreen entries={ceoChallengeLeaderboard.data ?? []} />}

        {manualScreen === 'auto' && renderAutoScreen()}
      </div>
    </div>
  );
}

function IdleScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-6">
      <img
        src="/nexus-logo-v2.png"
        alt="Nexus Multiverse 2026"
        className="w-full max-w-xl rounded-2xl border-[3px] border-ink shadow-[8px_8px_0px_#111111]"
      />
      <p className="text-xl font-bold text-navy">Waiting for the next phase…</p>
    </div>
  );
}

type ScanningMember = {
  id: string;
  fullName: string;
  homeDepartment: Department;
  avatarUrl: string | null;
  drafted: boolean;
  role: string;
};

/**
 * "Scanning members" — the big-screen roster of every participant CEOs can
 * recruit, live during TEAM_FORMATION. Sourced entirely from
 * useAdminParticipants (the same data the admin dashboard's own participant
 * list uses) — no separate/hardcoded roster. `drafted` is the existing
 * recruitment flag (see recruitCandidate/recruitParticipantByQr in
 * team.service.ts, which is what actually flips it) — a participant dims out
 * here the instant that happens, via the same socket-driven refetch the rest
 * of the admin views already rely on (see RealtimeProvider's
 * onUserDrafted/onMemberRecruited handlers, which invalidate
 * ['admin-participants']).
 */
function ScanningMembersScreen({ participants }: { participants: ScanningMember[] }) {
  // CEOs already have a team by definition — the recruitable roster is
  // participants only, same scope QR recruitment itself is restricted to.
  const roster = participants.filter((p) => p.role === 'PARTICIPANT');
  const available = roster.filter((p) => !p.drafted).length;

  return (
    <div className="w-full max-w-5xl flex flex-col items-center gap-6">
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-crimson border-2 border-ink animate-ping" />
        <h1 className="text-4xl font-black tracking-tight text-ink">TEAM FORMATION</h1>
        <p className="text-lg font-bold text-navy max-w-2xl">CEOs are scanning their new teammates&apos; QR badges.</p>
      </div>

      <p className="text-sm font-black uppercase tracking-widest text-forest" data-testid="scanning-members-count">
        {available} / {roster.length} still available
      </p>

      <div className="w-full grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-[55vh] overflow-y-auto pr-1">
        {roster.map((p) => (
          <div
            key={p.id}
            data-testid={`scanning-member-${p.id}`}
            data-recruited={p.drafted}
            className={`flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center border-[3px] border-ink transition-all duration-300 ${
              p.drafted ? 'bg-white/70 grayscale opacity-50' : 'bg-white shadow-[3px_3px_0px_#111111]'
            }`}
          >
            {/* Status dot on the photo itself (green = available, gray =
                recruited) — readable at a glance from across the room,
                rather than relying on people close enough to read the text
                badge below. */}
            <div className="relative">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-ink" />
              ) : (
                <div
                  className="w-12 h-12 rounded-full border-2 border-ink flex items-center justify-center text-sm font-black text-white"
                  style={{ backgroundColor: DEPARTMENT_COLORS[p.homeDepartment] }}
                  aria-hidden="true"
                >
                  {p.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                  p.drafted ? 'bg-navy/40' : 'bg-forest'
                }`}
                aria-hidden="true"
              />
            </div>
            <p className="text-xs font-bold truncate w-full">{p.fullName}</p>
            <span
              className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full border-2 ${
                p.drafted ? 'border-navy/30 text-navy/40' : 'border-forest text-forest'
              }`}
            >
              {p.drafted ? 'Recruited' : 'Available'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** SUBMISSIONS_OPEN / SUBMISSIONS_LOCKED — reuses useAdminDeliverables, the
 * same pitch-deck-status data the admin dashboard's own Teams panel already
 * reads (see getDeliverableStatus). Names the teams still missing a pitch
 * deck while submissions are open (actionable for the organizers watching
 * this screen — who to go nudge); once locked, that list stops being useful
 * to call out (nothing left to do about it), so just the tally remains. */
function SubmissionsScreen({ deliverables, open }: { deliverables: TeamDeliverableStatus[]; open: boolean }) {
  const submitted = deliverables.filter((d) => d.pitchDeck.status === 'UPLOADED').length;
  const pending = deliverables.filter((d) => d.pitchDeck.status !== 'UPLOADED');

  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-6">
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-crimson border-2 border-ink animate-ping" />
        <h1 className="text-4xl font-black tracking-tight text-ink">{open ? 'SUBMISSIONS OPEN' : 'SUBMISSIONS CLOSED'}</h1>
        <p className="text-lg font-bold text-navy max-w-2xl">
          {open ? 'Teams are uploading their pitch decks.' : 'Pitch decks are locked — judging starts soon.'}
        </p>
      </div>

      <div className="text-center">
        <p className="text-6xl font-black text-forest" data-testid="submissions-count">
          {submitted} / {deliverables.length}
        </p>
        <p className="text-sm font-black uppercase tracking-widest text-navy/50">teams have submitted</p>
      </div>

      {open && pending.length > 0 && (
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-xs font-black uppercase tracking-widest text-crimson">Still waiting on</p>
          <div className="flex flex-wrap justify-center gap-2 max-h-[30vh] overflow-y-auto">
            {pending.map((d) => (
              <span
                key={d.teamId}
                className="text-xs font-bold bg-white border-2 border-ink rounded-full px-3 py-1"
              >
                {d.teamName ?? '(unnamed)'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ranked list — team name with the CEO's name right beside it (per request:
 * "the ceo of team is shown besides the team name"), live average score,
 * and rank. Shared between JudgingScreen (live, mid-scoring) and
 * CompleteScreen (final) — same shape, only the heading differs. Teams with
 * no submitted evaluations yet show "—" for rank/score rather than a
 * misleading 0, and sort to the bottom (see admin.service.ts's getLeaderboard).
 */
function LeaderboardTable({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  if (leaderboard.length === 0) {
    return <p className="text-navy/50 font-bold">No finalized teams yet.</p>;
  }
  return (
    <div className="w-full max-w-3xl flex flex-col gap-2" data-testid="presenter-leaderboard">
      {leaderboard.map((row) => (
        <div
          key={row.teamId}
          data-testid={`presenter-leaderboard-row-${row.teamId}`}
          className="flex items-center gap-4 rounded-xl border-[3px] border-ink bg-white px-4 py-3 shadow-[3px_3px_0px_#111111]"
        >
          <span className="text-2xl font-black text-navy/40 w-10 text-center shrink-0">
            {row.evaluationsSubmitted > 0 ? `#${row.rank}` : '—'}
          </span>
          <div className="flex-1 text-left min-w-0">
            <p className="font-black text-ink truncate">
              {row.teamName ?? '(unnamed)'} <span className="font-bold text-navy/60">· CEO: {row.ceoName}</span>
            </p>
            <p className="text-xs text-navy/50 uppercase font-bold">{row.category ?? 'no category'}</p>
          </div>
          <span className="text-xl font-black text-forest shrink-0">
            {row.evaluationsSubmitted > 0 ? `${row.averageScore.toFixed(1)} / ${row.maxPossibleScore}` : 'Not yet scored'}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Manual override tab — the CEO Selection Challenge's own running
 * leaderboard (see useCeoChallengeLeaderboard), separate from the team
 * judging leaderboard above. Meant to be pulled up on demand during/after
 * the challenge, independent of the auto phase-driven screen.
 */
function CeoChallengeLeaderboardScreen({ entries }: { entries: CeoChallengeLeaderboardEntry[] }) {
  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-6">
      <div className="text-center flex flex-col items-center gap-2">
        <h1 className="text-4xl font-black tracking-tight text-ink">CEO CHALLENGE LEADERBOARD</h1>
        <p className="text-lg font-bold text-navy">
          Every participant, ranked by score — highest score wins a CEO seat.
        </p>
      </div>

      {entries.length === 0 && <p className="text-navy/50 font-bold">No participants yet.</p>}
      {entries.length > 0 && (
        <div className="w-full flex flex-col gap-2 max-h-[65vh] overflow-y-auto pr-1" data-testid="ceo-challenge-leaderboard">
          {entries.map((row) => (
            <div
              key={row.userId}
              data-testid={`ceo-challenge-leaderboard-row-${row.userId}`}
              className={`flex items-center gap-4 rounded-xl border-[3px] border-ink px-4 py-3 shadow-[3px_3px_0px_#111111] ${
                row.becameCeo ? 'bg-gold/40' : 'bg-white'
              }`}
            >
              <span className="text-2xl font-black text-navy/40 w-10 text-center shrink-0">#{row.rank}</span>
              {row.avatarUrl ? (
                <img src={row.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-ink shrink-0" />
              ) : (
                <div
                  className="w-10 h-10 rounded-full border-2 border-ink flex items-center justify-center text-sm font-black text-white bg-navy shrink-0"
                  aria-hidden="true"
                >
                  {row.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="flex-1 text-left font-black text-ink truncate">
                {row.fullName}
                {row.becameCeo && <span className="ml-2 text-xs font-black uppercase text-crimson">★ CEO</span>}
              </p>
              <span className="text-xl font-black text-forest shrink-0">{row.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** JUDGING — a live leaderboard (see LeaderboardTable) plus the same
 * aggregate submitted/possible tally the admin dashboard's own Judging panel
 * reads (getEvaluationOverview), so the room can see both "who's ahead right
 * now" and "how much judging is left." */
function JudgingScreen({ evaluations, leaderboard }: { evaluations: AdminEvaluationOverview[]; leaderboard: LeaderboardEntry[] }) {
  const submitted = evaluations.reduce((sum, e) => sum + e.evaluationsSubmitted, 0);
  const possible = evaluations.reduce((sum, e) => sum + e.totalJudges, 0);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-6">
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-crimson border-2 border-ink animate-ping" />
        <h1 className="text-4xl font-black tracking-tight text-ink">JUDGING IN PROGRESS</h1>
        <p className="text-lg font-bold text-navy max-w-2xl">Judges are scoring every finalized team.</p>
        <p className="text-sm font-black uppercase tracking-widest text-navy/50" data-testid="judging-count">
          {submitted} / {possible} evaluations submitted
        </p>
      </div>
      <LeaderboardTable leaderboard={leaderboard} />
    </div>
  );
}

/** COMPLETE — the final leaderboard (see LeaderboardTable), ranked by
 * average submitted judge score. */
function CompleteScreen({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-6">
      <img
        src="/nexus-logo-v2.png"
        alt="Nexus Multiverse 2026"
        className="w-full max-w-xl rounded-2xl border-[3px] border-ink shadow-[8px_8px_0px_#111111]"
      />
      <h1 className="text-4xl font-black tracking-tight text-ink">COMPETITION COMPLETE</h1>
      <p className="text-lg font-bold text-navy">Thank you for building with us today.</p>
      <LeaderboardTable leaderboard={leaderboard} />
    </div>
  );
}

/**
 * "Category selection" — a big 2×2 board of the four HEAT categories, each
 * showing its brand-kit icon (see heatCategoryAssets.ts — the same assets
 * CeoFinalizePage uses, untouched/un-stretched here too) and, once any
 * team(s) have finalized into it, a gold pill per team name to its right.
 *
 * The icon sits in a fixed-width first grid column (not just centered as a
 * group with the pills) specifically so it lands at the same spot in every
 * panel regardless of whether that panel has a team pill next to it yet — a
 * flex `justify-center` on the icon+pills pair as a whole would shift the
 * icon left in panels that DO have a pill and dead-center it in panels that
 * don't, visibly misaligning the four icons against each other. Team names
 * wrap (`break-words` + a capped width) rather than growing the pill
 * horizontally without bound, so a long team name can't push past the
 * panel's edge.
 *
 * Sourced entirely from useAdminOverview's `categoryUsage` — the same
 * capacity data CeoFinalizePage and the admin dashboard's HEAT Category
 * Capacity panel already read (see team.service.ts's getCategoryCapacities)
 * — no separate/new query, no separate/hardcoded roster. A category with no
 * teams yet just shows its icon, no placeholder pill — same "stay clean when
 * empty" rule ScanningMembersScreen follows for an unrecruited roster.
 * Already-live: categoryUsage updates via useAdminOverview's own poll plus
 * RealtimeProvider's onCategoryUpdated/onTeamFinalized socket handlers
 * (which invalidate ['admin-overview']), so a team finalizing into a
 * category — or a "New Competition" reset freeing one back up — shows up
 * here automatically, same as everywhere else that reads this data.
 */
function CategorySelectionScreen({ categoryUsage }: { categoryUsage: CategoryUsage[] }) {
  const byCategory = new Map(categoryUsage.map((c) => [c.category, c]));

  return (
    <div className="w-full max-w-5xl">
      <div className="relative grid grid-cols-2 gap-x-10 gap-y-8 sm:gap-x-16 sm:gap-y-10">
        {/* Where all four panels meet — purely decorative, echoes the same
            small dot accent used on the other manual screens. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gold border-2 border-ink z-10"
          aria-hidden="true"
        />

        {HEAT_CATEGORY_ORDER.map((category) => {
          const teams = byCategory.get(category)?.teams ?? [];
          return (
            <div
              key={category}
              data-testid={`presenter-category-panel-${category}`}
              className="min-h-[280px] sm:min-h-[340px] rounded-xl border-[3px] border-ink p-6 grid grid-cols-[auto_1fr] items-center gap-4 sm:gap-6"
            >
              {/* A fixed-width column (not just centering the icon+pill pair
                  as a group) is what keeps every icon at the exact same spot
                  regardless of whether its panel has a team pill next to it
                  yet — sizing this off the icon's own w-36/sm:w-52 keeps the
                  column exactly as wide as the (identically-sized, every
                  category) icon, no wasted/uneven gutter. */}
              <div className="w-36 sm:w-52 flex justify-center shrink-0">
                <img
                  src={HEAT_CATEGORY_ICONS[category]}
                  alt={category}
                  className="w-36 h-36 sm:w-52 sm:h-52 object-contain"
                  data-testid={`presenter-category-icon-${category}`}
                />
              </div>
              {teams.length > 0 && (
                // max-h + overflow-y-auto: a category can hold up to 3 teams
                // (see CategorySlot's capacity), and 3 wrapped pills stacked
                // with gap-2 could in principle run past the panel's own
                // height on a short/narrow screen — scrolling this list
                // specifically (rather than letting the panel grow and push
                // the 2x2 grid out of alignment) is what actually guarantees
                // pills never overlap each other or spill past the border.
                <div className="flex flex-col items-start gap-2 min-w-0 max-h-full overflow-y-auto py-1">
                  {teams.map((t) => (
                    <span
                      key={t.id}
                      data-testid={`presenter-category-team-${category}`}
                      className="max-w-full bg-gold text-ink font-black uppercase text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border-[3px] border-ink shadow-[3px_3px_0px_#111111] text-center break-words"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The same "Get Ready" brand-kit clip CeoFinalizePage plays (see
 * HEAT_DEFAULT_VIDEO) — reused here as-is for the big-screen welcome moment.
 * Not muted: the operator switches to this tab deliberately (a real user
 * gesture, so autoplay-with-sound isn't blocked), and this is a live
 * audience-facing screen where the audio is the point; `controls` lets them
 * replay/pause manually regardless. No team-name overlay here (unlike
 * CeoFinalizePage) — this is a generic broadcast, not tied to any one team,
 * so the moments that would carry a name just play through blank. */
function WelcomeScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <h1 className="text-5xl font-black tracking-tight text-ink">WELCOME</h1>
      <div className="w-full max-w-md aspect-[9/16] rounded-2xl border-[3px] border-ink shadow-[8px_8px_0px_#111111] bg-ink overflow-hidden">
        <video className="w-full h-full object-contain" autoPlay controls data-testid="presenter-welcome-video">
          <source src={HEAT_DEFAULT_VIDEO} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

/**
 * `aggregate` is undefined for the brief gap between a topic closing and its
 * first successful fetch landing (TanStack Query's `data` stays `undefined`
 * until then) — rendered as a spinner + "Loading results…" rather than not
 * rendering at all, so the screen never sits there looking frozen on a
 * projector with no visible sign anything is happening. `isLoading` is only
 * true for that very first fetch; every 1.5s poll after that keeps the
 * previous `aggregate` on screen while it refetches, so live updates never
 * flash back to this loading state.
 */
function TopAnswersOverlay({
  aggregate,
  isLoading,
}: {
  aggregate: { question: string; correctAnswer: string; top5: { answer: string; count: number; isCorrect: boolean }[]; totalSubmitted: number } | undefined;
  isLoading: boolean;
}) {
  if (!aggregate) {
    return (
      <div className="fixed inset-0 bg-canvas/95 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-[3px] border-ink border-t-transparent animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-navy/60">
            {isLoading ? 'Loading results…' : 'Waiting for results…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-canvas/95 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-crimson">Top answers · {aggregate.question}</p>

        {/* Shown every time, regardless of whether/how many people got it
            right — the room should always be told the actual answer, not
            just left to infer it from which submitted answer (if any) got
            the "✓ Correct" badge below. */}
        {aggregate.correctAnswer && (
          <div className="rounded-xl px-5 py-3 bg-forest text-cream border-[3px] border-ink shadow-[4px_4px_0px_#111111]">
            <p className="text-xs font-black uppercase tracking-widest opacity-80">Correct answer</p>
            <p className="text-2xl font-black">{aggregate.correctAnswer}</p>
          </div>
        )}

        <div className="w-full flex flex-col gap-2">
          {aggregate.top5.length === 0 && <p className="text-navy font-bold">No answers submitted.</p>}
          {aggregate.top5.map((a, i) => (
            <div
              key={a.answer}
              className={`flex items-center justify-between rounded-xl px-5 py-3 text-lg font-bold border-[3px] border-ink ${
                a.isCorrect ? 'bg-lime/40 text-ink shadow-[4px_4px_0px_#111111]' : 'bg-white text-navy'
              }`}
            >
              <span className="flex items-center gap-2">
                {/* A color tint alone (lime vs white) doesn't read clearly
                    at a glance on a projector — an explicit
                    correct/incorrect badge does. */}
                <span
                  className={`shrink-0 text-xs font-black uppercase tracking-wide px-2 py-0.5 rounded-full border-2 border-ink ${
                    a.isCorrect ? 'bg-forest text-cream' : 'bg-white text-navy/50'
                  }`}
                >
                  {a.isCorrect ? '✓ Correct' : '✗ Wrong'}
                </span>
                {i + 1}. {a.answer}
              </span>
              <span className="text-sm font-black text-navy/50">×{a.count}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-navy/50">{aggregate.totalSubmitted} answers submitted so far</p>
      </div>
    </div>
  );
}

function RevealScreen({ winners, onDone }: { winners: ChallengeEndPayload['winners']; onDone: () => void }) {
  return (
    <div className="text-center flex flex-col items-center gap-8">
      <h1 className="text-4xl font-black tracking-tight text-crimson">MEET YOUR NEW CEOs</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {winners.map((w, i) => (
          <div
            key={w.userId}
            className="flex flex-col items-center gap-3 opacity-0 animate-[fadeIn_0.6s_ease-out_forwards]"
            style={{ animationDelay: `${i * 250}ms` }}
          >
            {w.avatarUrl ? (
              <img src={w.avatarUrl} alt={w.fullName} className="w-32 h-32 rounded-full object-cover border-4 border-ink shadow-[5px_5px_0px_#111111]" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gold border-4 border-ink shadow-[5px_5px_0px_#111111] flex items-center justify-center text-4xl font-black text-ink">
                {w.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-xl font-black text-ink">{w.fullName}</p>
          </div>
        ))}
      </div>
      <button onClick={onDone} className={comicButton('white')}>
        Continue to team formation
      </button>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
