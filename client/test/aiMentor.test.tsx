import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { AiMentorPanel } from '../src/pages/team/AiMentorPanel';
import { apiClient } from '../src/lib/apiClient';
import type { AiSessionDetail, AiSessionSummary } from '../src/types/api';

// jsdom doesn't implement Element.scrollTo — the panel calls it to keep the
// conversation scrolled to the latest message.
Element.prototype.scrollTo = vi.fn();

function mockSessionSummary(overrides: Partial<AiSessionSummary> = {}): AiSessionSummary {
  return {
    id: 'session_1',
    title: 'Ideation help',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: { id: 'ceo_1', name: 'Grace Hopper' },
    ...overrides,
  };
}

function mockSessionDetail(overrides: Partial<AiSessionDetail> = {}): AiSessionDetail {
  return {
    ...mockSessionSummary(),
    messages: [],
    ...overrides,
  };
}

function axiosErrorWithCode(code: string, status: number) {
  return new AxiosError(
    'Request failed',
    String(status),
    { headers: new AxiosHeaders(), method: 'post', url: '/team/ai/sessions/session_1/messages' },
    {},
    { status, statusText: 'Error', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: `Failed: ${code}` } } },
  );
}

function renderPanel(opts: { sessions?: AiSessionSummary[]; sessionDetail?: AiSessionDetail } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['ai-sessions'], opts.sessions ?? []);
  if (opts.sessionDetail) {
    queryClient.setQueryData(['ai-sessions', opts.sessionDetail.id], opts.sessionDetail);
  }
  render(
    <QueryClientProvider client={queryClient}>
      <AiMentorPanel />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('AI Mentor panel (frontend)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. the AI mentor panel renders', () => {
    renderPanel();
    expect(screen.getByTestId('ai-mentor-panel')).toBeInTheDocument();
    expect(screen.getByText('AI MENTOR')).toBeInTheDocument();
  });

  it('2. shows an empty state when no session is selected', () => {
    renderPanel();
    expect(screen.getByTestId('ai-empty-state')).toBeInTheDocument();
  });

  it('3. selecting a session shows the message input', async () => {
    const summary = mockSessionSummary();
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    await userEvent.setup().click(screen.getByTestId(`ai-session-${summary.id}`));
    expect(await screen.findByTestId('ai-message-input')).toBeInTheDocument();
  });

  it('4. the send button is disabled until text is entered', async () => {
    const summary = mockSessionSummary();
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    const sendButton = await screen.findByTestId('ai-send-button');
    expect(sendButton).toBeDisabled();
    await user.type(screen.getByTestId('ai-message-input'), 'Hello');
    expect(sendButton).not.toBeDisabled();
  });

  it('5. shows a loading/thinking state while waiting for the assistant', async () => {
    const summary = mockSessionSummary();
    let resolveSend!: (v: unknown) => void;
    vi.spyOn(apiClient, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }) as never,
    );
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Help us improve.');
    await user.click(screen.getByTestId('ai-send-button'));
    expect(await screen.findByTestId('ai-thinking')).toBeInTheDocument();
    resolveSend({
      data: {
        userMessage: { id: 'm1', role: 'USER', content: 'Help us improve.', createdAt: new Date().toISOString() },
        assistantMessage: { id: 'm2', role: 'ASSISTANT', content: 'Try focusing on...', createdAt: new Date().toISOString() },
      },
    });
  });

  it('6. a successful send displays the assistant response', async () => {
    const summary = mockSessionSummary();
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        userMessage: { id: 'm1', role: 'USER', content: 'Help us improve.', createdAt: new Date().toISOString() },
        assistantMessage: { id: 'm2', role: 'ASSISTANT', content: 'Try focusing on your target users.', createdAt: new Date().toISOString() },
      },
    } as never);
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url.includes('/sessions/session_1')) {
        return Promise.resolve({
          data: mockSessionDetail({
            id: summary.id,
            messages: [
              { id: 'm1', role: 'USER', content: 'Help us improve.', createdAt: new Date().toISOString() },
              { id: 'm2', role: 'ASSISTANT', content: 'Try focusing on your target users.', createdAt: new Date().toISOString() },
            ],
          }),
        }) as never;
      }
      return Promise.resolve({ data: [summary] }) as never;
    });
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Help us improve.');
    await user.click(screen.getByTestId('ai-send-button'));
    expect(await screen.findByText('Try focusing on your target users.')).toBeInTheDocument();
  });

  it('7. shows an error state when sending fails', async () => {
    const summary = mockSessionSummary();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('AI_REQUEST_FAILED', 502));
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Will this fail?');
    await user.click(screen.getByTestId('ai-send-button'));
    expect(await screen.findByTestId('ai-error')).toBeInTheDocument();
  });

  it('8. a retry button resubmits the failed message', async () => {
    const summary = mockSessionSummary();
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(axiosErrorWithCode('AI_REQUEST_FAILED', 502))
      .mockResolvedValueOnce({
        data: {
          userMessage: { id: 'm1', role: 'USER', content: 'Retry me.', createdAt: new Date().toISOString() },
          assistantMessage: { id: 'm2', role: 'ASSISTANT', content: 'Retried successfully.', createdAt: new Date().toISOString() },
        },
      } as never);
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Retry me.');
    await user.click(screen.getByTestId('ai-send-button'));
    await screen.findByTestId('ai-retry-button');
    await user.click(screen.getByTestId('ai-retry-button'));
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));
  });

  it('9. an existing session loads its conversation', async () => {
    const summary = mockSessionSummary();
    renderPanel({
      sessions: [summary],
      sessionDetail: mockSessionDetail({
        id: summary.id,
        messages: [{ id: 'm1', role: 'USER', content: 'Previously asked question.', createdAt: new Date().toISOString() }],
      }),
    });
    await userEvent.setup().click(screen.getByTestId(`ai-session-${summary.id}`));
    expect(await screen.findByText('Previously asked question.')).toBeInTheDocument();
  });

  it('10. a new session can be created', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockSessionSummary({ id: 'session_new', title: null }) } as never);
    renderPanel({ sessions: [] });
    await userEvent.setup().click(screen.getByTestId('ai-new-session-button'));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/team/ai/sessions', { title: undefined }));
  });

  it('11. switching between sessions shows the selected session', async () => {
    const first = mockSessionSummary({ id: 'session_1', title: 'First' });
    const second = mockSessionSummary({ id: 'session_2', title: 'Second' });
    const queryClient = renderPanel({
      sessions: [first, second],
      sessionDetail: mockSessionDetail({ id: 'session_1', title: 'First', messages: [] }),
    });
    queryClient.setQueryData(['ai-sessions', 'session_2'], mockSessionDetail({ id: 'session_2', title: 'Second', messages: [] }));
    const user = userEvent.setup();
    await user.click(screen.getByTestId('ai-session-session_1'));
    expect(screen.getByTestId('ai-session-session_1').className).toMatch(/bg-primary-600/);
    await user.click(screen.getByTestId('ai-session-session_2'));
    expect(screen.getByTestId('ai-session-session_2').className).toMatch(/bg-primary-600/);
  });

  it('12. a session can be deleted', async () => {
    const summary = mockSessionSummary();
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: { id: summary.id } } as never);
    renderPanel({ sessions: [summary] });
    await userEvent.setup().click(screen.getByTestId(`ai-delete-session-${summary.id}`));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(`/team/ai/sessions/${summary.id}`));
  });

  it('13. sending a message never requires the caller to supply project context (server derives it)', async () => {
    const summary = mockSessionSummary();
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        userMessage: { id: 'm1', role: 'USER', content: 'Review our project.', createdAt: new Date().toISOString() },
        assistantMessage: { id: 'm2', role: 'ASSISTANT', content: 'Looks solid.', createdAt: new Date().toISOString() },
      },
    } as never);
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Review our project.');
    await user.click(screen.getByTestId('ai-send-button'));
    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith(`/team/ai/sessions/${summary.id}/messages`, { message: 'Review our project.' }),
    );
  });

  it('14. shows an AI-not-configured state distinctly from a generic error', async () => {
    const summary = mockSessionSummary();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('AI_NOT_CONFIGURED', 503));
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Hello?');
    await user.click(screen.getByTestId('ai-send-button'));
    expect(await screen.findByTestId('ai-not-configured')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-error')).not.toBeInTheDocument();
  });

  it('15. shows a rate-limited state distinctly from a generic error', async () => {
    const summary = mockSessionSummary();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('AI_RATE_LIMITED', 429));
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    await user.type(await screen.findByTestId('ai-message-input'), 'Hello?');
    await user.click(screen.getByTestId('ai-send-button'));
    expect(await screen.findByTestId('ai-rate-limited')).toBeInTheDocument();
  });

  it('16. a message over 4000 characters shows a validation error and disables send', async () => {
    const summary = mockSessionSummary();
    renderPanel({ sessions: [summary], sessionDetail: mockSessionDetail({ id: summary.id }) });
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`ai-session-${summary.id}`));
    const input = await screen.findByTestId('ai-message-input');
    await user.click(input);
    await user.paste('A'.repeat(4001));
    expect(await screen.findByTestId('ai-length-error')).toBeInTheDocument();
    expect(screen.getByTestId('ai-send-button')).toBeDisabled();
  });

  it("17. the panel doesn't crash or block the rest of the Team Hub when AI is unavailable", async () => {
    const summary = mockSessionSummary();
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(axiosErrorWithCode('AI_NOT_CONFIGURED', 503));
    renderPanel({ sessions: [summary] });
    // No unhandled crash — the panel just shows its own contained state.
    expect(screen.getByTestId('ai-mentor-panel')).toBeInTheDocument();
  });

  it('18. the panel uses a responsive, mobile-first layout', () => {
    renderPanel();
    const panel = screen.getByTestId('ai-mentor-panel');
    expect(panel.className).toMatch(/flex-col/);
    expect(panel.className).toMatch(/sm:flex-row/);
  });

  it('19. no session cookie, access code, or API key ever appears in the rendered panel', async () => {
    const summary = mockSessionSummary();
    renderPanel({
      sessions: [summary],
      sessionDetail: mockSessionDetail({
        id: summary.id,
        messages: [{ id: 'm1', role: 'ASSISTANT', content: 'Here is some advice.', createdAt: new Date().toISOString() }],
      }),
    });
    await userEvent.setup().click(screen.getByTestId(`ai-session-${summary.id}`));
    await screen.findByText('Here is some advice.');
    expect(document.body.innerHTML).not.toMatch(/accessCode|qrToken|passwordHash|XAI_API_KEY/i);
  });
});
