import { useRef, useState } from 'react';
import { Badge } from '../../components/Badge';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import {
  fetchPitchDeckVersionUrl,
  fetchTeamFileUrl,
  useDeleteTeamFile,
  usePitchDeck,
  useReplacePitchDeck,
  useTeamFiles,
  useUploadPitchDeck,
  useUploadTeamFile,
} from '../../hooks/useTeamFiles';
import type { FileCategory, FileMetadata } from '../../types/api';

const PITCH_DECK_EXTENSIONS = ['pdf', 'ppt', 'pptx'];
const DOCUMENT_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'doc', 'docx'];
const ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg'];
const PITCH_DECK_ACCEPT = '.pdf,.ppt,.pptx';
const DOCUMENT_ACCEPT = '.pdf,.ppt,.pptx,.doc,.docx';
const ASSET_ACCEPT = '.png,.jpg,.jpeg';

const MAX_DOC_BYTES = 25 * 1024 * 1024;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function validateClientSide(file: File, extensions: string[], maxBytes: number): string | null {
  if (!extensions.includes(extensionOf(file.name))) {
    return `File type not allowed. Allowed: ${extensions.join(', ').toUpperCase()}.`;
  }
  if (file.size > maxBytes) {
    return `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`;
  }
  return null;
}

type UploadState = { status: 'idle' | 'uploading' | 'error'; progress: number; error: string | null };
const IDLE: UploadState = { status: 'idle', progress: 0, error: null };

async function openFile(fetchUrl: () => Promise<string>) {
  try {
    const url = await fetchUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // best-effort — a failed view/download doesn't need its own error UI,
    // the user can just retry the click.
  }
}

export function DeliverablesSection({ ceoId }: { ceoId: string }) {
  return (
    <div className="flex flex-col gap-6" data-testid="deliverables-section">
      <PitchDeckPanel />
      <TeamFilesPanel type="DOCUMENT" ceoId={ceoId} />
      <TeamFilesPanel type="PROJECT_ASSET" ceoId={ceoId} />
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden" data-testid="upload-progress">
      <div className="h-full bg-primary-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function PitchDeckPanel() {
  const { data, isLoading } = usePitchDeck();
  const upload = useUploadPitchDeck();
  const replace = useReplacePitchDeck();
  const [state, setState] = useState<UploadState>(IDLE);
  const inputRef = useRef<HTMLInputElement>(null);

  const isReplace = Boolean(data?.current);
  const busy = state.status === 'uploading';

  function handleFile(file: File) {
    const clientError = validateClientSide(file, PITCH_DECK_EXTENSIONS, MAX_DOC_BYTES);
    if (clientError) {
      setState({ status: 'error', progress: 0, error: clientError });
      return;
    }
    setState({ status: 'uploading', progress: 0, error: null });
    const onProgress = (progress: number) => setState((s) => ({ ...s, progress }));
    const onError = (err: unknown) => setState({ status: 'error', progress: 0, error: getApiErrorMessage(err) });
    const onSettled = () => {
      if (inputRef.current) inputRef.current.value = '';
    };

    if (isReplace && data?.current) {
      replace.mutate(
        { id: data.current.id, file, onProgress },
        { onSuccess: () => setState(IDLE), onError, onSettled },
      );
    } else {
      upload.mutate({ file, onProgress }, { onSuccess: () => setState(IDLE), onError, onSettled });
    }
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="pitch-deck-section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">PITCH DECK</h2>
        <button
          data-testid="pitch-deck-upload-button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="text-sm px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold"
        >
          {busy ? 'Uploading…' : isReplace ? 'Replace' : 'Upload Pitch Deck'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={PITCH_DECK_ACCEPT}
          className="hidden"
          data-testid="pitch-deck-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {busy && (
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-xs text-slate-400">Uploading… {state.progress}%</p>
          <ProgressBar percent={state.progress} />
        </div>
      )}
      {state.status === 'error' && (
        <p className="text-xs text-red-400 mb-4" data-testid="pitch-deck-error">
          {state.error}
        </p>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {!isLoading && !data?.current && (
        <p className="text-sm text-slate-100" data-testid="pitch-deck-status">
          Not uploaded
        </p>
      )}

      {data?.current && (
        <div data-testid="pitch-deck-current">
          <Badge tone="primary">CURRENT VERSION — v{data.current.version}</Badge>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-3">
            <div>
              <dt className="text-slate-500 text-xs uppercase font-semibold">Filename</dt>
              <dd className="text-slate-100 font-medium mt-0.5">{data.current.filename}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase font-semibold">Uploaded By</dt>
              <dd className="text-slate-100 font-medium mt-0.5">{data.current.uploadedBy.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase font-semibold">Uploaded At</dt>
              <dd className="text-slate-100 font-medium mt-0.5">{new Date(data.current.createdAt).toLocaleString()}</dd>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => openFile(() => fetchPitchDeckVersionUrl(data.current!.id))}
                className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                VIEW
              </button>
              <button
                onClick={() => openFile(() => fetchPitchDeckVersionUrl(data.current!.id))}
                className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                DOWNLOAD
              </button>
            </div>
          </dl>
        </div>
      )}

      {data && data.previousVersions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800" data-testid="pitch-deck-previous-versions">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Previous versions</p>
          <ul className="flex flex-col gap-1 text-xs text-slate-400">
            {data.previousVersions.map((v) => (
              <li key={v.id} className="flex justify-between gap-2" data-testid={`pitch-deck-version-${v.version}`}>
                <span>
                  v{v.version} · {v.filename}
                </span>
                <button
                  onClick={() => openFile(() => fetchPitchDeckVersionUrl(v.id))}
                  className="text-primary-400 hover:underline"
                >
                  VIEW
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const PANEL_CONFIG: Record<
  'DOCUMENT' | 'PROJECT_ASSET',
  { title: string; testid: string; uploadLabel: string; extensions: string[]; accept: string; maxBytes: number }
> = {
  DOCUMENT: {
    title: 'DOCUMENTS',
    testid: 'documents-section',
    uploadLabel: 'Upload Document',
    extensions: DOCUMENT_EXTENSIONS,
    accept: DOCUMENT_ACCEPT,
    maxBytes: MAX_DOC_BYTES,
  },
  PROJECT_ASSET: {
    title: 'PROJECT ASSETS',
    testid: 'project-assets-section',
    uploadLabel: 'Upload Asset',
    extensions: ASSET_EXTENSIONS,
    accept: ASSET_ACCEPT,
    maxBytes: MAX_ASSET_BYTES,
  },
};

function TeamFilesPanel({ type, ceoId }: { type: 'DOCUMENT' | 'PROJECT_ASSET'; ceoId: string }) {
  const config = PANEL_CONFIG[type];
  const { data, isLoading } = useTeamFiles();
  const upload = useUploadTeamFile(type as FileCategory);
  const remove = useDeleteTeamFile();
  const [state, setState] = useState<UploadState>(IDLE);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCeo = useAuthStore((s) => s.user?.id) === ceoId;

  const files = (data ?? []).filter((f) => f.type === type);
  const busy = state.status === 'uploading';

  function handleFile(file: File) {
    const clientError = validateClientSide(file, config.extensions, config.maxBytes);
    if (clientError) {
      setState({ status: 'error', progress: 0, error: clientError });
      return;
    }
    setState({ status: 'uploading', progress: 0, error: null });
    upload.mutate(
      { file, onProgress: (progress) => setState((s) => ({ ...s, progress })) },
      {
        onSuccess: () => setState(IDLE),
        onError: (err) => setState({ status: 'error', progress: 0, error: getApiErrorMessage(err) }),
        onSettled: () => {
          if (inputRef.current) inputRef.current.value = '';
        },
      },
    );
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid={config.testid}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">{config.title}</h2>
        <button
          data-testid={`${config.testid}-upload-button`}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="text-sm px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold"
        >
          {busy ? 'Uploading…' : config.uploadLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          className="hidden"
          data-testid={`${config.testid}-file-input`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {busy && (
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-xs text-slate-400">Uploading… {state.progress}%</p>
          <ProgressBar percent={state.progress} />
        </div>
      )}
      {state.status === 'error' && (
        <p className="text-xs text-red-400 mb-4" data-testid={`${config.testid}-error`}>
          {state.error}
        </p>
      )}
      {getApiErrorCode(upload.error) === 'CLOUDINARY_NOT_CONFIGURED' && (
        <p className="text-xs text-amber-400 mb-4">File storage isn&apos;t configured on this server yet.</p>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && files.length === 0 && <p className="text-sm text-slate-100">No files uploaded yet.</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {files.map((f) => (
            <FileRow key={f.id} file={f} canDelete={isCeo} onDelete={() => remove.mutate(f.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FileRow({ file, canDelete, onDelete }: { file: FileMetadata; canDelete: boolean; onDelete: () => void }) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-2 bg-slate-800 rounded-lg px-3 py-2"
      data-testid={`file-row-${file.id}`}
    >
      <div>
        <p className="text-slate-100 font-medium">{file.filename}</p>
        <p className="text-xs text-slate-500">
          {formatBytes(file.size)} · {file.uploadedBy.name} · {new Date(file.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => openFile(() => fetchTeamFileUrl(file.id))}
          className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100"
        >
          VIEW
        </button>
        <button
          onClick={() => openFile(() => fetchTeamFileUrl(file.id))}
          className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100"
        >
          DOWNLOAD
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-900 text-red-200"
          >
            DELETE
          </button>
        )}
      </div>
    </li>
  );
}
