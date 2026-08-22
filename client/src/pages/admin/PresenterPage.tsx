import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackground } from '../../components/AmbientBackground';
import { CountdownTimer } from '../../components/CountdownTimer';
import { useSyncedTopic } from '../../hooks/useSyncedTopic';
import { useAdminHackathonState, useAdminParticipants, useCeoQuestions, useLiveAnswerAggregate } from '../../hooks/useAdmin';
import { getSocket } from '../../lib/socket';
import { comicButton } from '../../lib/comic';
import type { ChallengeAnswerSubmittedPayload, ChallengeEndPayload } from '../../types/realtime';

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
        {manualScreen === 'recruiting' && <MessageScreen title="TEAM FORMATION" subtitle="CEOs are scanning their new teammates' QR badges." />}
        {manualScreen === 'welcome' && <WelcomeScreen />}
        {manualScreen === 'category' && <MessageScreen title="SELECT YOUR HEAT CATEGORY" subtitle="Each CEO is choosing Health, Environment, Agriculture, or Tourism for their team." />}

        {manualScreen === 'auto' && (
          <>
            {showReveal && lastWinners && (
              <RevealScreen winners={lastWinners} onDone={() => setShowReveal(false)} />
            )}

            {!showReveal && roundActive && currentQuestion && answerEndsAtMs > 0 && (
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
                <p className="text-sm font-bold text-navy">{answeredNow.size} / {roster.length} answered</p>

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
      <img
        src="/nexus-logo-v2.png"
        alt="Nexus Multiverse 2026"
        className="w-full max-w-xl rounded-2xl border-[3px] border-ink shadow-[8px_8px_0px_#111111]"
      />
      <p className="text-xl font-bold text-navy">Waiting for the next phase…</p>
    </div>
  );
}

function MessageScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <div className="w-4 h-4 rounded-full bg-crimson border-2 border-ink animate-ping" />
      <h1 className="text-5xl font-black tracking-tight text-ink">{title}</h1>
      <p className="text-xl font-bold text-navy max-w-2xl">{subtitle}</p>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <h1 className="text-5xl font-black tracking-tight text-ink">WELCOME</h1>
      {/* Drop a real welcome video/animation here once the event team supplies
          one, e.g. <video src="/welcome.mp4" autoPlay muted className="max-h-[70vh]" /> */}
      <div className="w-full max-w-3xl aspect-video rounded-2xl border-[3px] border-dashed border-ink flex items-center justify-center bg-white">
        <p className="text-navy/50 text-sm font-bold uppercase">Welcome video plays here</p>
      </div>
    </div>
  );
}

function TopAnswersOverlay({ aggregate }: { aggregate: { question: string; top5: { answer: string; count: number; isCorrect: boolean }[]; totalSubmitted: number } }) {
  return (
    <div className="fixed inset-0 bg-canvas/95 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-crimson">Top answers · {aggregate.question}</p>
        <div className="w-full flex flex-col gap-2">
          {aggregate.top5.length === 0 && <p className="text-navy font-bold">No answers submitted.</p>}
          {aggregate.top5.map((a, i) => (
            <div
              key={a.answer}
              className={`flex items-center justify-between rounded-xl px-5 py-3 text-lg font-bold border-[3px] border-ink ${
                a.isCorrect ? 'bg-lime/40 text-ink shadow-[4px_4px_0px_#111111]' : 'bg-white text-navy'
              }`}
            >
              <span>
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
