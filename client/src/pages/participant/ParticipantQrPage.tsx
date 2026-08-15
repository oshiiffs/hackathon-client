import { Link, Navigate } from 'react-router-dom';
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

  // A CEO scanning this badge flips `user.drafted` on this participant's own
  // socket (see RealtimeProvider's onMemberRecruited, which refetches /auth/me
  // for exactly this client) — once that lands, there's nothing left to show
  // here, so send them back to the dashboard rather than leaving them staring
  // at a QR code that's no longer useful.
  if (user?.drafted) {
    return <Navigate to="/participant" replace />;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center" data-testid="participant-qr-page">
      <div>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">HACKVERSE 2026</h2>
        <p className="text-lg font-bold text-accent-400 mt-1">MY TEAM QR</p>
      </div>

      {isLoading && <LoadingState label="Generating your QR code…" />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {qr && user && (
        <>
          <QRBadge qrPayload={qr.qrPayload} fullName={user.fullName} homeDepartment={user.homeDepartment} />
          <p className="text-slate-400 text-sm max-w-xs">Show this QR code to your CEO.</p>
          <Link to="/participant" className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition">
            ← Back to dashboard
          </Link>
        </>
      )}
    </div>
  );
}
