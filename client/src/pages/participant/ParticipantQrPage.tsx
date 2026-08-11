import { LoadingState, ErrorState } from '../../components/StateViews';
import { QRBadge } from '../../components/QRBadge';
import { useMyQr } from '../../hooks/useQr';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../lib/apiClient';

/**
 * The badge shown here is stable — the backend returns the SAME qrPayload
 * every time (see useMyQr), so refreshing this page never invalidates a
 * badge a CEO already scanned.
 */
export function ParticipantQrPage() {
  const user = useAuthStore((s) => s.user);
  const { data: qr, isLoading, error, refetch } = useMyQr();

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center" data-testid="participant-qr-page">
      <div>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">HACKATHON 2026</h2>
        <p className="text-lg font-bold text-accent-400 mt-1">MY TEAM QR</p>
      </div>

      {isLoading && <LoadingState label="Generating your QR code…" />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {qr && user && (
        <>
          <QRBadge qrPayload={qr.qrPayload} fullName={user.fullName} homeDepartment={user.homeDepartment} />
          <p className="text-slate-400 text-sm max-w-xs">Show this QR code to your CEO.</p>
        </>
      )}
    </div>
  );
}
