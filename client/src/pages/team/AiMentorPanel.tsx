import { useEffect, useRef, useState } from 'react';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';
import {
  useAiSession,
  useAiSessions,
  useCreateAiSession,
  useDeleteAiSession,
  useSendAiMessage,
} from '../../hooks/useAiMentor';

const MAX_MESSAGE_LENGTH = 4000;

export function AiMentorPanel() {
  const sessions = useAiSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const createSession = useCreateAiSession();
  const deleteSession = useDeleteAiSession();
  const session = useAiSession(selectedId);
  const sendMessage = useSendAiMessage(selectedId);

  const [draft, setDraft] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [session.data?.messages, sendMessage.isPending]);

  const notConfigured = getApiErrorCode(sendMessage.error) === 'AI_NOT_CONFIGURED';
  const rateLimited = getApiErrorCode(sendMessage.error) === 'AI_RATE_LIMITED';
  const overLength = draft.length > MAX_MESSAGE_LENGTH;

  function submit(text: string) {
    if (!selectedId || !text.trim() || overLength) return;
    sendMessage.mutate(text.trim(), {
      onSuccess: () => {
        setLastFailedMessage(null);
        setDraft('');
      },
      onError: () => setLastFailedMessage(text.trim()),
    });
  }

  return (
    <section className="comic-panel p-6 flex flex-col sm:flex-row gap-4" data-testid="ai-mentor-panel">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-crimson" aria-hidden="true" />
      <div className="sm:w-56 flex flex-col gap-2" data-testid="ai-session-list">
        <div className="flex items-center justify-between">
          <h2 className={`text-lg ${comicHeading}`}>AI MENTOR</h2>
        </div>
        <p className="text-xs font-bold text-navy">Ask Grok for help with your project.</p>
        <button
          data-testid="ai-new-session-button"
          disabled={createSession.isPending}
          onClick={() => createSession.mutate(undefined, { onSuccess: (s) => setSelectedId(s.id) })}
          className={comicButton('forest', 'sm')}
        >
          + New session
        </button>

        <div className="flex flex-col gap-1 mt-2 max-h-56 overflow-y-auto">
          {sessions.data?.length === 0 && <p className="text-xs font-bold text-navy/40">No sessions yet.</p>}
          {sessions.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                data-testid={`ai-session-${s.id}`}
                onClick={() => setSelectedId(s.id)}
                className={`flex-1 text-left text-xs px-2 py-1.5 rounded-lg truncate font-bold border-2 border-ink ${
                  s.id === selectedId ? 'bg-forest text-cream' : 'bg-white text-navy hover:bg-cream'
                }`}
              >
                {s.title ?? 'Untitled session'}
              </button>
              <button
                data-testid={`ai-delete-session-${s.id}`}
                aria-label="Delete session"
                onClick={() => {
                  deleteSession.mutate(s.id);
                  if (selectedId === s.id) setSelectedId(null);
                }}
                className="text-xs px-1.5 py-1 rounded-lg border-2 border-ink bg-crimson/10 hover:bg-crimson/20 text-crimson font-black"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!selectedId && (
          <p className="text-sm font-bold text-navy flex-1" data-testid="ai-empty-state">
            Select a session or start a new one to talk with the AI mentor.
          </p>
        )}

        {selectedId && (
          <>
            <div ref={scrollRef} className="h-72 overflow-y-auto flex flex-col gap-3 pr-1" data-testid="ai-conversation">
              {session.isLoading && <p className="text-navy font-bold text-sm">Loading conversation…</p>}
              {session.data?.messages.length === 0 && (
                <p className="text-navy font-bold text-sm">No messages yet — ask your first question below.</p>
              )}
              {session.data?.messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-0.5" data-testid={`ai-message-${m.id}`}>
                  <span className="text-[10px] uppercase font-black text-forest">{m.role === 'USER' ? 'YOU' : 'AI MENTOR'}</span>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap border-[3px] border-ink ${
                      m.role === 'USER' ? 'self-end bg-forest text-cream' : 'self-start bg-white text-ink shadow-[2px_2px_0px_#111111]'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="self-start text-navy text-sm font-bold italic" data-testid="ai-thinking">
                  Mentor is thinking…
                </div>
              )}
            </div>

            {notConfigured && (
              <p className="text-xs font-bold text-forest" data-testid="ai-not-configured">
                AI mentor isn&apos;t configured on this server yet.
              </p>
            )}
            {rateLimited && (
              <p className="text-xs font-bold text-forest" data-testid="ai-rate-limited">
                Too many AI requests — please wait a moment before trying again.
              </p>
            )}
            {sendMessage.isError && !notConfigured && !rateLimited && (
              <div className="flex items-center gap-2" data-testid="ai-error">
                <p className="text-xs font-bold text-crimson">{getApiErrorMessage(sendMessage.error)}</p>
                {lastFailedMessage && (
                  <button data-testid="ai-retry-button" onClick={() => submit(lastFailedMessage)} className={comicButton('white', 'xs')}>
                    Retry
                  </button>
                )}
              </div>
            )}

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
            >
              <input
                data-testid="ai-message-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about your problem statement…"
                className="flex-1 min-w-0 rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
              />
              <button type="submit" data-testid="ai-send-button" disabled={sendMessage.isPending || !draft.trim() || overLength} className={comicButton('crimson')}>
                Send
              </button>
            </form>
            {overLength && (
              <p className="text-xs font-bold text-crimson" data-testid="ai-length-error">
                Messages must be {MAX_MESSAGE_LENGTH} characters or fewer ({draft.length}/{MAX_MESSAGE_LENGTH}).
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
