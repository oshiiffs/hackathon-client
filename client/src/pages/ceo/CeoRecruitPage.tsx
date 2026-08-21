import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { QrScanner } from '../../components/QrScanner';
import { useMyTeam } from '../../hooks/useTeam';
import { useScanQr, useRecruitParticipant } from '../../hooks/useQr';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiClient';
import { comicButton } from '../../lib/comic';
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
        <h2 className="text-2xl font-black text-forest uppercase">TEAM COMPLETE</h2>
        <p className="text-navy text-sm font-bold">5 / 5 members recruited.</p>
        <p className="text-crimson font-black text-sm mt-2 uppercase">NEXT: FINALIZE TEAM</p>
        <Link to="/ceo/team/finalize" className={`mt-2 ${comicButton('crimson')}`}>
          FINALIZE TEAM
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center" data-testid="ceo-recruit-page">
      <div>
        <h2 className="text-2xl font-black text-ink tracking-tight uppercase">SCAN TEAM MEMBER</h2>
        <p className="text-navy text-sm mt-1 font-bold">Point the camera at a participant QR code.</p>
      </div>

      {cameraError ? (
        <div className="flex flex-col items-center gap-3 py-8" data-testid="camera-unavailable">
          <p className="text-crimson font-black uppercase">Camera unavailable</p>
          <p className="text-sm font-bold text-navy max-w-xs">{cameraError}</p>
          <button
            onClick={() => {
              setCameraError(null);
              setCameraAttempt((n) => n + 1);
            }}
            className={comicButton('white', 'sm')}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm" data-testid="scanner-region">
          <QrScanner key={cameraAttempt} onScan={handleDetected} onError={setCameraError} paused={scannerPaused} />
        </div>
      )}

      {scanState.kind === 'checking' && (
        <p className="text-navy font-bold text-sm" data-testid="scan-checking">
          Checking…
        </p>
      )}

      {(scanState.kind === 'found' || scanState.kind === 'confirming' || scanState.kind === 'recruiting') && (
        <div className="comic-panel-sm flex flex-col items-center gap-3 px-6 py-5 max-w-sm" data-testid="scan-result-found">
          <p className="text-forest font-black text-sm tracking-wide uppercase">MEMBER FOUND</p>
          <p className="text-xl font-black text-ink">{scanState.result.participant.name}</p>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-forest text-xs uppercase font-black">Department</p>
              <p className="text-ink font-black mt-0.5">{scanState.result.participant.department}</p>
            </div>
            <div>
              <p className="text-forest text-xs uppercase font-black">Status</p>
              <p className="text-forest font-black mt-0.5">AVAILABLE</p>
            </div>
          </div>
          <button
            data-testid="continue-to-recruit-button"
            disabled={scanState.kind !== 'found'}
            onClick={openConfirm}
            className={`mt-2 ${comicButton('crimson')}`}
          >
            RECRUIT MEMBER
          </button>
        </div>
      )}

      {scanState.kind === 'confirming' && (
        <div className="fixed inset-0 bg-ink/70 flex items-center justify-center p-4 z-10" data-testid="recruit-confirm-dialog">
          <div className="bg-white border-[3px] border-ink rounded-xl p-6 max-w-sm flex flex-col items-center gap-4 text-center shadow-[8px_8px_0px_#111111]">
            <p className="text-ink font-black">
              Recruit {scanState.result.participant.name} as {scanState.result.participant.department}?
            </p>
            <p className="text-navy text-sm font-medium">This will permanently add them to your team.</p>
            <div className="flex gap-3">
              <button data-testid="cancel-recruit-button" onClick={cancelConfirm} className={comicButton('white', 'sm')}>
                CANCEL
              </button>
              <button data-testid="confirm-recruit-button" onClick={confirmRecruit} className={comicButton('crimson', 'sm')}>
                RECRUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {scanState.kind === 'recruiting' && (
        <p className="text-navy font-bold text-sm" data-testid="recruiting-loading">
          Recruiting…
        </p>
      )}

      {scanState.kind === 'recruited' && (
        <div className="comic-panel-sm flex flex-col items-center gap-3 px-6 py-5 max-w-sm" data-testid="scan-result-recruited">
          <p className="text-forest font-black text-sm tracking-wide uppercase">MEMBER RECRUITED</p>
          <p className="text-xl font-black text-ink">{scanState.recruit.member.name}</p>
          <p className="text-navy text-sm font-bold">{scanState.recruit.member.department}</p>
          <p className="text-sm text-ink font-bold" data-testid="member-count-transition">
            Team: {scanState.previousCount} / 5 → {scanState.recruit.team.memberCount} / 5
          </p>
          {scanState.recruit.team.memberCount >= 5 ? (
            <>
              <p className="text-forest font-black text-sm mt-1 uppercase">TEAM COMPLETE</p>
              <Link to="/ceo/team/finalize" className={`mt-1 ${comicButton('crimson')}`}>
                FINALIZE TEAM
              </Link>
            </>
          ) : (
            <button data-testid="scan-another-button" onClick={scanAnother} className={`mt-2 ${comicButton('white', 'sm')}`}>
              SCAN ANOTHER
            </button>
          )}
        </div>
      )}

      {scanState.kind === 'rejected' && (
        <div className="comic-panel-sm flex flex-col items-center gap-3 px-6 py-5 max-w-sm" data-testid="scan-result-rejected">
          <p className="text-crimson font-black text-sm tracking-wide uppercase">{REJECTION_COPY[scanState.code]?.title ?? 'INVALID QR CODE'}</p>
          <p className="text-navy text-sm font-medium">{REJECTION_COPY[scanState.code]?.body ?? scanState.message}</p>
          <button data-testid="scan-another-button" onClick={scanAnother} className={`mt-2 ${comicButton('white', 'sm')}`}>
            SCAN ANOTHER
          </button>
        </div>
      )}
    </div>
  );
}
