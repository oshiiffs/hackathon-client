import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CountdownTimer } from '../../components/CountdownTimer';
import { useAdminHackathonState, useAdminParticipants, useCeoQuestions, useLiveAnswerAggregate } from '../../hooks/useAdmin';
import { getSocket } from '../../lib/socket';
import type { ChallengeAnswerSubmittedPayload, ChallengeEndPayload } from '../../types/realtime';

/** Mirrors ParticipantChallengePage's useSyncedTopic exactly — the presenter
 * screen has to land on the same topic index at the same moment every
 * participant's own screen does, purely from the same server timestamps. */
function useSyncedTopic(startedAt: string | null | undefined, durationSeconds: number, serverNow: string | undefined, totalTopics: number) {
  const [, forceTick] = useState(0);
  const offsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (serverNow && offsetRef.current === null) {
      offsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, [serverNow]);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 200);
    return () => clearInterval(interval);
  }, []);

  if (!startedAt || totalTopics === 0) {
    return { topicIndex: 0, topicEndsAtMs: 0, roundOver: false };
  }

  const offset = offsetRef.current ?? 0;
  const nowCorrected = Date.now() + offset;
  const startedAtMs = new Date(startedAt).getTime();
  const perTopicMs = durationSeconds * 1000;
  const elapsedMs = Math.max(0, nowCorrected - startedAtMs);
  const rawIndex = Math.floor(elapsedMs / perTopicMs);
  const topicIndex = Math.min(rawIndex, totalTopics - 1);
  const topicEndsAtMs = startedAtMs + (topicIndex + 1) * perTopicMs;

  return { topicIndex, topicEndsAtMs, roundOver: rawIndex >= totalTopics };
}

type ManualScreen = 'auto' | 'recruiting' | 'welcome' | 'category';

const MANUAL_SCREENS: { id: ManualScreen; label: string }[] = [
  { id: 'auto', label: 'Live (auto)' },
  { id: 'recruiting', label: 'Scanning members' },
  { id: 'welcome', label: 'Welcome video' },
  { id: 'category', label: 'Category selection' },
];

/**
 * The big-screen/LCD view for competition day — cast this tab, not the admin
 * dashboard. Auto-follows the event phase (CEO Challenge timer + live
 * "who's answered" board + top-5-answers recap + CEO reveal); the strip at
 * the bottom lets the operator cut to the other FLOW steps (scanning,
 * welcome video, category selection) that don't have a single piece of
 * server state driving them. There's no bundled welcome-video asset — the
 * "Welcome video" screen is a placeholder slot for whatever file the event
 * team supplies; see the comment on WelcomeScreen below for where to point it.
 */
export function PresenterPage() {
  const { data: state } = useAdminHackathonState();
  const questions = useCeoQuestions();
  const participants = useAdminParticipants();

  const [manualScreen, setManualScreen] = useState<ManualScreen>('auto');
  const [answeredByQuestion, setAnsweredByQuestion] = useState<Record<string, Map<string, string>>>({});
  const [lastWinners, setLastWinners] = useState<ChallengeEndPayload['winners'] | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  const activeQuestions = (questions.data ?? [])
    .filter((q) => q.isActive)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const { topicIndex, topicEndsAtMs, roundOver } = useSyncedTopic(
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
  const prevTopicIndexRef = useRef<number | null>(null);
  const [recapQuestionId, setRecapQuestionId] = useState<string | null>(null);
  useEffect(() => {
    if (!roundActive) return;
    if (prevTopicIndexRef.current !== null && prevTopicIndexRef.current !== topicIndex) {
      const endedQuestion = activeQuestions[prevTopicIndexRef.current];
      if (endedQuestion) {
        setRecapQuestionId(endedQuestion.id);
        const timer = setTimeout(() => setRecapQuestionId(null), 15000);
        return () => clearTimeout(timer);
      }
    }
    prevTopicIndexRef.current = topicIndex;
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <img src="/hackverse-icon.png" alt="" className="w-6 h-6 rounded-md" />
          <Link to="/admin/dashboard" className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition">
            ← Exit presenter view
          </Link>
        </div>
        <div className="flex gap-1.5">
          {MANUAL_SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => setManualScreen(s.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                manualScreen === s.id ? 'bg-primary-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        {manualScreen === 'recruiting' && <MessageScreen title="TEAM FORMATION" subtitle="CEOs are scanning their new teammates' QR badges." />}
        {manualScreen === 'welcome' && <WelcomeScreen />}
        {manualScreen === 'category' && <MessageScreen title="SELECT YOUR HEAT CATEGORY" subtitle="Each CEO is choosing Health, Environment, Agriculture, or Tourism for their team." />}

        {manualScreen === 'auto' && (
          <>
            {showReveal && lastWinners && (
              <RevealScreen winners={lastWinners} onDone={() => setShowReveal(false)} />
            )}

            {!showReveal && roundActive && currentQuestion && topicEndsAtMs > 0 && (
              <div className="w-full max-w-5xl flex flex-col items-center gap-8">
                <p className="text-lg font-bold uppercase tracking-widest text-accent-400">
                  Topic {topicIndex + 1} of {activeQuestions.length}
                </p>
                <CountdownTimer endsAt={new Date(topicEndsAtMs).toISOString()} serverNow={state!.serverNow} />
                <h1 className="text-5xl font-black text-center tracking-tight">{currentQuestion.question}</h1>

                <div className="w-full grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-4">
                  {roster.map((p) => {
                    const lit = answeredNow.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg px-2 py-2 text-center text-xs font-bold truncate transition-all duration-300 ${
                          lit ? 'bg-primary-500 text-white scale-105 shadow-lg shadow-primary-500/30' : 'bg-slate-900 text-slate-600'
                        }`}
                      >
                        {p.fullName}
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-slate-500">{answeredNow.size} / {roster.length} answered</p>

                {recapQuestionId && recapAggregate.data && (
                  <TopAnswersOverlay aggregate={recapAggregate.data} />
                )}
              </div>
            )}

            {!showReveal && !roundActive && <IdleScreen />}
          </>
        )}
      </div>
    </div>
  );
}

function IdleScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-6">
      <img src="/hackverse-logo-badge.png" alt="HackVerse 2026" className="w-full max-w-xl rounded-3xl shadow-2xl" />
      <p className="text-xl text-slate-400">Waiting for the next phase…</p>
    </div>
  );
}

function MessageScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <div className="w-3 h-3 rounded-full bg-primary-500 animate-ping" />
      <h1 className="text-5xl font-black tracking-tight">{title}</h1>
      <p className="text-xl text-slate-400 max-w-2xl">{subtitle}</p>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <h1 className="text-5xl font-black tracking-tight">WELCOME</h1>
      {/* Drop a real welcome video/animation here once the event team supplies
          one, e.g. <video src="/welcome.mp4" autoPlay muted className="max-h-[70vh]" /> */}
      <div className="w-full max-w-3xl aspect-video rounded-2xl border-2 border-dashed border-slate-800 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Welcome video plays here</p>
      </div>
    </div>
  );
}

function TopAnswersOverlay({ aggregate }: { aggregate: { question: string; top5: { answer: string; count: number; isCorrect: boolean }[]; totalSubmitted: number } }) {
  return (
    <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-accent-400">Top answers · {aggregate.question}</p>
        <div className="w-full flex flex-col gap-2">
          {aggregate.top5.length === 0 && <p className="text-slate-500">No answers submitted.</p>}
          {aggregate.top5.map((a, i) => (
            <div
              key={a.answer}
              className={`flex items-center justify-between rounded-xl px-5 py-3 text-lg font-bold ${
                a.isCorrect ? 'bg-primary-500/20 text-primary-300 border border-primary-600/40' : 'bg-slate-900 text-slate-200'
              }`}
            >
              <span>
                {i + 1}. {a.answer}
              </span>
              <span className="text-sm font-semibold text-slate-400">×{a.count}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">{aggregate.totalSubmitted} answers submitted so far</p>
      </div>
    </div>
  );
}

function RevealScreen({ winners, onDone }: { winners: ChallengeEndPayload['winners']; onDone: () => void }) {
  return (
    <div className="text-center flex flex-col items-center gap-8">
      <h1 className="text-4xl font-black tracking-tight text-accent-400">MEET YOUR NEW CEOs</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {winners.map((w, i) => (
          <div
            key={w.userId}
            className="flex flex-col items-center gap-3 opacity-0 animate-[fadeIn_0.6s_ease-out_forwards]"
            style={{ animationDelay: `${i * 250}ms` }}
          >
            {w.avatarUrl ? (
              <img src={w.avatarUrl} alt={w.fullName} className="w-32 h-32 rounded-full object-cover border-4 border-accent-500" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-slate-800 border-4 border-accent-500 flex items-center justify-center text-4xl font-black text-accent-300">
                {w.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-xl font-black">{w.fullName}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onDone}
        className="mt-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-5 py-2.5 transition"
      >
        Continue to team formation
      </button>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
