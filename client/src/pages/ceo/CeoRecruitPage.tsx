import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { QrScanner } from '../../components/QrScanner';
import { useMyTeam } from '../../hooks/useTeam';
import { useScanQr, useRecruitParticipant } from '../../hooks/useQr';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import type { QrScanResult, RecruitResult } from '../../types/api';

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'checking' }
  | { kind: 'found'; result: QrScanResult; qrPayload: string }
  | { kind: 'confirming'; result: QrScanResult; qrPayload: string; previousCount: number }
  | { kind: 'recruiting'; result: QrScanResult; previousCount: number }
  | { kind: 'recruited'; recruit: RecruitResult; previousCount: number }
  | { kind: 'rejected'; code: string; message: string };

const REJECTION_COPY: Record<string, { title: string; body: string }> = {
  PARTICIPANT_ALREADY_DRAFTED: {
    title: 'NOT AVAILABLE',
    body: 'This participant has already been recruited by another team.',
  },
  PARTICIPANT_ALREADY_ON_TEAM: {
    title: 'NOT AVAILABLE',
    body: 'This participant is already assigned to a team.',
  },
  DEPARTMENT_UNAVAILABLE: {
    title: 'DEPARTMENT UNAVAILABLE',
    body: 'That department is already occupied by your team.',
  },
  DEPARTMENT_SLOT_TAKEN: {
    title: 'DEPARTMENT UNAVAILABLE',
    body: 'That department is already occupied by your team.',
  },
  TEAM_FULL: {
    title: 'TEAM FULL',
    body: 'Your team already has all 5 members.',
  },
  RECRUITMENT_CLOSED: {
    title: 'RECRUITMENT CLOSED',
    body: 'Your team has already been finalized.',
  },
  PHASE_NOT_ALLOWED: {
    title: 'NOT AVAILABLE RIGHT NOW',
    body: 'Recruitment is not open at this time.',
  },
};

/**
 * The real atomic recruitment flow. A successful scan-qr preview is never
 * trusted as the final answer — "RECRUIT" always calls the real endpoint,
 * which re-checks everything against Postgres and can still reject a preview
 * that was valid moments ago (someone else recruited them meanwhile, etc).
 */
export function CeoRecruitPage() {
  const { data: team, isLoading, error, refetch } = useMyTeam();
  const scanQr = useScanQr();
  const recruitParticipant = useRecruitParticipant();
  const [scanState, setScanState] = useState<ScanState>({ kind: 'scanning' });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  if (isLoading) return <LoadingState label="Loading your team…" />;
  if (error || !team) return <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />;

  const teamIsFull = scanState.kind === 'recruited' ? scanState.recruit.team.memberCount >= 5 : team.members.length >= 5;

  function handleDetected(payload: string) {
    if (scanState.kind !== 'scanning') return; // already processing this detection
    setScanState({ kind: 'checking' });
    scanQr.mutate(payload, {
      onSuccess: (data) => setScanState({ kind: 'found', result: data, qrPayload: payload }),
      onError: (err) => {
        const code = getApiErrorCode(err) ?? 'INVALID_QR';
        setScanState({ kind: 'rejected', code, message: getApiErrorMessage(err) });
      },
    });
  }

  function openConfirm() {
    if (scanState.kind !== 'found') return;
    setScanState({ kind: 'confirming', result: scanState.result, qrPayload: scanState.qrPayload, previousCount: team!.members.length });
  }

  function cancelConfirm() {
    if (scanState.kind !== 'confirming') return;
    setScanState({ kind: 'found', result: scanState.result, qrPayload: scanState.qrPayload });
  }

  function confirmRecruit() {
    if (scanState.kind !== 'confirming') return;
    const { result, qrPayload, previousCount } = scanState;
    setScanState({ kind: 'recruiting', result, previousCount });
    recruitParticipant.mutate(qrPayload, {
      onSuccess: (data) => setScanState({ kind: 'recruited', recruit: data, previousCount }),
      onError: (err) => {
        const code = getApiErrorCode(err) ?? 'INVALID_QR';
        setScanState({ kind: 'rejected', code, message: getApiErrorMessage(err) });
      },
    });
  }

  function scanAnother() {
    setScanState({ kind: 'scanning' });
  }

  const scannerPaused = scanState.kind !== 'scanning';

  if (teamIsFull && scanState.kind === 'scanning') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center" data-testid="team-complete">
        <p className="text-5xl">🎉</p>
        <h2 className="text-2xl font-black text-primary-400">TEAM COMPLETE</h2>
        <p className="text-slate-400 text-sm">5 / 5 members recruited.</p>
        <p className="text-accent-300 font-bold text-sm mt-2">NEXT: FINALIZE TEAM</p>
        <Link
          to="/ceo/team/finalize"
          className="mt-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-black px-4 py-2 text-sm transition"
        >
          FINALIZE TEAM
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center" data-testid="ceo-recruit-page">
      <div>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">SCAN TEAM MEMBER</h2>
        <p className="text-slate-400 text-sm mt-1">Point the camera at a participant QR code.</p>
      </div>

      {cameraError ? (
        <div className="flex flex-col items-center gap-3 py-8" data-testid="camera-unavailable">
          <p className="text-red-400 font-semibold">Camera unavailable</p>
          <p className="text-sm text-slate-400 max-w-xs">{cameraError}</p>
          <button
            onClick={() => {
              setCameraError(null);
              setCameraAttempt((n) => n + 1);
            }}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold px-4 py-2 transition"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm" data-testid="scanner-region">
          <QrScanner key={cameraAttempt} onScan={handleDetected} onError={setCameraError} paused={scannerPaused} />
        </div>
      )}

      {scanState.kind === 'checking' && <p className="text-slate-400 text-sm" data-testid="scan-checking">Checking…</p>}

      {(scanState.kind === 'found' || scanState.kind === 'confirming' || scanState.kind === 'recruiting') && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-primary-700 bg-primary-950 px-6 py-5 max-w-sm" data-testid="scan-result-found">
          <p className="text-primary-300 font-black text-sm tracking-wide">MEMBER FOUND</p>
          <p className="text-xl font-bold text-slate-100">{scanState.result.participant.name}</p>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-slate-500 text-xs uppercase font-semibold">Department</p>
              <p className="text-slate-100 font-bold mt-0.5">{scanState.result.participant.department}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase font-semibold">Status</p>
              <p className="text-accent-400 font-bold mt-0.5">AVAILABLE</p>
            </div>
          </div>
          <button
            data-testid="continue-to-recruit-button"
            disabled={scanState.kind !== 'found'}
            onClick={openConfirm}
            className="mt-2 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-slate-950 font-black px-5 py-2.5 text-sm transition"
          >
            RECRUIT MEMBER
          </button>
        </div>
      )}

      {scanState.kind === 'confirming' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-10"
          data-testid="recruit-confirm-dialog"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm flex flex-col items-center gap-4 text-center">
            <p className="text-slate-100 font-bold">
              Recruit {scanState.result.participant.name} as {scanState.result.participant.department}?
            </p>
            <p className="text-slate-400 text-sm">This will permanently add them to your team.</p>
            <div className="flex gap-3">
              <button
                data-testid="cancel-recruit-button"
                onClick={cancelConfirm}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold px-4 py-2 transition"
              >
                CANCEL
              </button>
              <button
                data-testid="confirm-recruit-button"
                onClick={confirmRecruit}
                className="rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-black px-4 py-2 text-sm transition"
              >
                RECRUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {scanState.kind === 'recruiting' && (
        <p className="text-slate-400 text-sm" data-testid="recruiting-loading">
          Recruiting…
        </p>
      )}

      {scanState.kind === 'recruited' && (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-accent-700 bg-accent-950/40 px-6 py-5 max-w-sm"
          data-testid="scan-result-recruited"
        >
          <p className="text-accent-300 font-black text-sm tracking-wide">MEMBER RECRUITED</p>
          <p className="text-xl font-bold text-slate-100">{scanState.recruit.member.name}</p>
          <p className="text-slate-400 text-sm">{scanState.recruit.member.department}</p>
          <p className="text-sm text-slate-300" data-testid="member-count-transition">
            Team: {scanState.previousCount} / 5 → {scanState.recruit.team.memberCount} / 5
          </p>
          {scanState.recruit.team.memberCount >= 5 ? (
            <>
              <p className="text-primary-300 font-black text-sm mt-1">TEAM COMPLETE</p>
              <Link
                to="/ceo/team/finalize"
                className="mt-1 rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-black px-4 py-2 text-sm transition"
              >
                FINALIZE TEAM
              </Link>
            </>
          ) : (
            <button
              data-testid="scan-another-button"
              onClick={scanAnother}
              className="mt-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold px-4 py-2 transition"
            >
              SCAN ANOTHER
            </button>
          )}
        </div>
      )}

      {scanState.kind === 'rejected' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-800 bg-red-950/30 px-6 py-5 max-w-sm" data-testid="scan-result-rejected">
          <p className="text-red-400 font-black text-sm tracking-wide">
            {REJECTION_COPY[scanState.code]?.title ?? 'INVALID QR CODE'}
          </p>
          <p className="text-slate-400 text-sm">{REJECTION_COPY[scanState.code]?.body ?? scanState.message}</p>
          <button
            data-testid="scan-another-button"
            onClick={scanAnother}
            className="mt-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold px-4 py-2 transition"
          >
            SCAN ANOTHER
          </button>
        </div>
      )}
    </div>
  );
}
