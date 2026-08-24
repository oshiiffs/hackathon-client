import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { DeliverablesSection } from '../src/pages/team/DeliverablesSection';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import type { FileMetadata, PitchDeckResponse, PublicUser } from '../src/types/api';

const CEO_ID = 'ceo_1';
const MEMBER_ID = 'member_1';

function mockUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: MEMBER_ID,
    fullName: 'Juan Dela Cruz',
    email: null,
    homeDepartment: 'COE',
    slotDepartment: 'COE',
    role: 'PARTICIPANT',
    drafted: true,
    teamId: 'team_1',
    nickname: null,
    bio: null,
    skills: [],
    avatarUrl: null,
    ...overrides,
  };
}

function emptyPitchDeck(): PitchDeckResponse {
  return { current: null, previousVersions: [] };
}

function currentPitchDeck(overrides: Partial<FileMetadata> = {}): PitchDeckResponse {
  return {
    current: {
      id: 'deck_v2',
      filename: 'pitch-v2.pdf',
      type: 'PITCH_DECK',
      mimeType: 'application/pdf',
      size: 204800,
      version: 2,
      uploadedBy: { id: CEO_ID, name: 'Grace Hopper' },
      createdAt: new Date().toISOString(),
      isCurrent: true,
      ...overrides,
    },
    previousVersions: [
      {
        id: 'deck_v1',
        filename: 'pitch-v1.pdf',
        type: 'PITCH_DECK',
        mimeType: 'application/pdf',
        size: 190000,
        version: 1,
        uploadedBy: { id: CEO_ID, name: 'Grace Hopper' },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        isCurrent: false,
      },
    ],
  };
}

function mockDocument(overrides: Partial<FileMetadata> = {}): FileMetadata {
  return {
    id: 'doc_1',
    filename: 'requirements.pdf',
    type: 'DOCUMENT',
    mimeType: 'application/pdf',
    size: 51200,
    version: null,
    uploadedBy: { id: MEMBER_ID, name: 'Juan Dela Cruz' },
    createdAt: new Date().toISOString(),
    isCurrent: true,
    ...overrides,
  };
}

function axiosErrorWithCode(code: string, status = 400) {
  return new AxiosError(
    'Request failed',
    String(status),
    { headers: new AxiosHeaders(), method: 'post', url: '/team/files/upload' },
    {},
    { status, statusText: 'Error', headers: {}, config: { headers: new AxiosHeaders() }, data: { error: { code, message: `Failed: ${code}` } } },
  );
}

function renderSection(opts: { pitchDeck?: PitchDeckResponse; files?: FileMetadata[]; ceoId?: string; asCeo?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  queryClient.setQueryData(['pitch-deck'], opts.pitchDeck ?? emptyPitchDeck());
  queryClient.setQueryData(['team-files'], opts.files ?? []);
  const ceoId = opts.ceoId ?? CEO_ID;
  useAuthStore.setState({ user: mockUser({ id: opts.asCeo ? ceoId : MEMBER_ID }), status: 'authenticated' });

  render(
    <QueryClientProvider client={queryClient}>
      <DeliverablesSection ceoId={ceoId} />
    </QueryClientProvider>,
  );
  return queryClient;
}

function makeFile(name: string, type: string, sizeBytes = 1024) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

describe('Phase 10 file management (frontend)', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('1. renders the pitch deck, documents, and project assets sections', () => {
    renderSection();
    expect(screen.getByTestId('deliverables-section')).toBeInTheDocument();
    expect(screen.getByTestId('pitch-deck-section')).toBeInTheDocument();
    expect(screen.getByTestId('documents-section')).toBeInTheDocument();
    expect(screen.getByTestId('project-assets-section')).toBeInTheDocument();
  });

  it('2. each section shows an upload button', () => {
    renderSection();
    expect(screen.getByTestId('pitch-deck-upload-button')).toBeInTheDocument();
    expect(screen.getByTestId('documents-section-upload-button')).toBeInTheDocument();
    expect(screen.getByTestId('project-assets-section-upload-button')).toBeInTheDocument();
  });

  it('3. clicking the documents upload button targets a hidden file picker', async () => {
    const user = userEvent.setup();
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    await user.click(screen.getByTestId('documents-section-upload-button'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('4. selecting a disallowed file type shows a client-side validation error', async () => {
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    // A real attacker (or a renamed file dragged in) isn't constrained by the
    // input's `accept` hint — fireEvent bypasses user-event's accept-filtering
    // simulation to exercise the component's OWN validation, same as a raw
    // DOM change event would in a real browser.
    Object.defineProperty(input, 'files', { value: [makeFile('virus.exe', 'application/x-msdownload')] });
    fireEvent.change(input);
    expect(await screen.findByTestId('documents-section-error')).toHaveTextContent(/not allowed/i);
  });

  it('5. selecting an oversized file shows a client-side validation error', async () => {
    const user = userEvent.setup();
    renderSection();
    const input = screen.getByTestId('project-assets-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('huge.png', 'image/png', 11 * 1024 * 1024));
    expect(await screen.findByTestId('project-assets-section-error')).toHaveTextContent(/10MB limit/i);
  });

  it('6. upload progress displays while an upload is in flight', async () => {
    const user = userEvent.setup();
    let resolveUpload!: (v: unknown) => void;
    vi.spyOn(apiClient, 'post').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }) as never,
    );
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('report.pdf', 'application/pdf'));
    expect(await screen.findByTestId('upload-progress')).toBeInTheDocument();
    resolveUpload({ data: mockDocument() });
  });

  it('7. a successful upload clears the uploading state', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockDocument() } as never);
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('report.pdf', 'application/pdf'));
    await waitFor(() => expect(screen.getByTestId('documents-section-upload-button')).not.toBeDisabled());
  });

  it('8. a failed upload shows a real error message, never a fake success', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('FILE_TOO_LARGE'));
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('report.pdf', 'application/pdf'));
    expect(await screen.findByTestId('documents-section-error')).toHaveTextContent(/FILE_TOO_LARGE/);
  });

  it('9. after a failed upload the upload button is re-enabled so the user can retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('UPLOAD_FAILED', 502));
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('report.pdf', 'application/pdf'));
    await screen.findByTestId('documents-section-error');
    expect(screen.getByTestId('documents-section-upload-button')).not.toBeDisabled();
  });

  it('10. the pitch deck CURRENT VERSION is shown distinctly', () => {
    renderSection({ pitchDeck: currentPitchDeck() });
    expect(screen.getByText(/CURRENT VERSION/)).toBeInTheDocument();
    expect(screen.getByTestId('pitch-deck-current')).toHaveTextContent('pitch-v2.pdf');
  });

  it('11. previous pitch deck versions are listed separately from the current one', () => {
    renderSection({ pitchDeck: currentPitchDeck() });
    const previous = screen.getByTestId('pitch-deck-previous-versions');
    expect(previous).toHaveTextContent('pitch-v1.pdf');
    expect(screen.getByTestId('pitch-deck-current')).not.toHaveTextContent('pitch-v1.pdf');
  });

  it('12. replacing the pitch deck posts to the replace endpoint for the current version id', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockDocument() } as never);
    renderSection({ pitchDeck: currentPitchDeck() });
    const input = screen.getByTestId('pitch-deck-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('pitch-v3.pdf', 'application/pdf'));
    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('/team/pitch-deck/deck_v2/replace', expect.anything(), expect.anything()));
  });

  it('13. the documents list renders filename, size, and uploader', () => {
    renderSection({ files: [mockDocument()] });
    const row = screen.getByTestId('file-row-doc_1');
    expect(row).toHaveTextContent('requirements.pdf');
    expect(row).toHaveTextContent('Juan Dela Cruz');
  });

  it('14. the VIEW action opens an inline preview (not a new tab) for a PDF', async () => {
    // Not window.open() — see DeliverablesSection.tsx's doc comment on why
    // (a scripted window.open() after this async fetch gets silently
    // popup-blocked). Mocks global.fetch with real "%PDF" magic bytes so
    // viewFileAsBlob's own content check passes and a blob: URL is actually
    // produced — asserting an iframe exists with SOME blob: src is as
    // precise as this can get, since URL.createObjectURL's exact return
    // value isn't something a test should hardcode.
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { ...mockDocument(), fileUrl: 'https://cloudinary.com/x.pdf' } } as never);
    const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake pdf bytes');
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(pdfBytes.buffer) } as never);
    // jsdom doesn't implement URL.createObjectURL — stub it directly
    // (there's no existing method to vi.spyOn) and restore afterward.
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-preview-url');
    try {
      renderSection({ files: [mockDocument()] });
      await user.click(screen.getByTestId('file-row-doc_1').querySelector('button')!);
      const iframe = await screen.findByTitle('requirements.pdf');
      expect(iframe.getAttribute('src')).toMatch(/^blob:/);
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
    }
  });

  it("14b. a failed preview fetch shows an error instead of silently downloading or opening a tab", async () => {
    // This is the regression this whole preview-fetch path exists to
    // prevent: falling back to the raw fileUrl as the iframe/window target
    // on failure just reproduces "view downloads instead of showing" under
    // a different code path (that URL has no extension for an
    // older-than-the-fix upload, so Cloudinary serves it as a generic
    // download). A clear in-page error, pointing at DOWNLOAD, is the
    // correct failure mode instead.
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { ...mockDocument(), fileUrl: 'https://cloudinary.com/x.pdf' } } as never);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false } as never);
    renderSection({ files: [mockDocument()] });
    await user.click(screen.getByTestId('file-row-doc_1').querySelector('button')!);
    expect(await screen.findByText(/couldn.t load the preview/i)).toBeInTheDocument();
    expect(screen.queryByTitle('requirements.pdf')).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('15. the DOWNLOAD action falls back to opening the file URL if the blob fetch fails', async () => {
    // jsdom has no real network, so downloadFile's own `fetch(fileUrl)` call
    // fails here regardless — this test is exercising that exact fallback
    // path (see downloadFile's catch block), not a mocked failure.
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { ...mockDocument(), fileUrl: 'https://cloudinary.com/y.pdf' } } as never);
    renderSection({ files: [mockDocument()] });
    const buttons = screen.getByTestId('file-row-doc_1').querySelectorAll('button');
    await user.click(buttons[1]!);
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://cloudinary.com/y.pdf', '_blank', 'noopener,noreferrer'));
  });

  it('15b. the DOWNLOAD action saves the file under its real filename, not whatever the URL looks like', async () => {
    // The whole point of downloadFile's blob approach: even a fileUrl with
    // no recognizable extension (the old bug — see files.service.ts's
    // rawPublicId doc comment) must still download as "requirements.pdf",
    // because the saved name comes from the DB's filename column, not the URL.
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { ...mockDocument(), fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/some-uuid-no-extension' },
    } as never);
    const fakeBlob = new Blob(['file bytes'], { type: 'application/pdf' });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(fakeBlob) } as never);

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.fn();
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = revokeObjectURLSpy;
    let capturedDownloadName = '';
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      capturedDownloadName = this.download;
    });

    try {
      renderSection({ files: [mockDocument()] });
      const buttons = screen.getByTestId('file-row-doc_1').querySelectorAll('button');
      await user.click(buttons[1]!); // VIEW, DOWNLOAD, (DELETE if CEO) — index 1 is DOWNLOAD

      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(fetchSpy).toHaveBeenCalledWith('https://res.cloudinary.com/demo/raw/upload/v1/some-uuid-no-extension');
      expect(capturedDownloadName).toBe('requirements.pdf');
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('16. a realtime file list update (the same mechanism the socket handler uses) refreshes the documents list', async () => {
    const queryClient = renderSection({ files: [] });
    expect(screen.queryByTestId('file-row-doc_1')).not.toBeInTheDocument();

    queryClient.setQueryData(['team-files'], [mockDocument()]);
    expect(await screen.findByTestId('file-row-doc_1')).toBeInTheDocument();
  });

  it('17. a CLOUDINARY_NOT_CONFIGURED upload error is surfaced distinctly', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(axiosErrorWithCode('CLOUDINARY_NOT_CONFIGURED', 503));
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('report.pdf', 'application/pdf'));
    expect(await screen.findByText(/isn.t configured/i)).toBeInTheDocument();
  });

  it('18. a non-CEO team member does not see a DELETE action on files', () => {
    renderSection({ files: [mockDocument()], asCeo: false });
    expect(screen.getByTestId('file-row-doc_1').querySelectorAll('button')).toHaveLength(2);
  });

  it('19. the CEO sees a DELETE action and can remove a file', async () => {
    const user = userEvent.setup();
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: { id: 'doc_1' } } as never);
    renderSection({ files: [mockDocument()], asCeo: true });
    const buttons = screen.getByTestId('file-row-doc_1').querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    await user.click(buttons[2]!);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('/team/files/doc_1'));
  });

  it('20. the sections stack in a responsive, mobile-first layout', () => {
    renderSection();
    const container = screen.getByTestId('deliverables-section');
    expect(container.className).toMatch(/flex-col/);
  });

  it('21. no fake upload success is shown when the backend is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network Error'));
    renderSection();
    const input = screen.getByTestId('documents-section-file-input') as HTMLInputElement;
    await user.upload(input, makeFile('report.pdf', 'application/pdf'));
    expect(await screen.findByTestId('documents-section-error')).toBeInTheDocument();
    expect(screen.queryByTestId('file-row-doc_1')).not.toBeInTheDocument();
  });
});
