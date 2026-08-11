import { useEffect, useState } from 'react';

/**
 * Purely a display component. The authoritative deadline (`endsAt`) and the
 * server's own clock (`serverNow`) come from Postgres via the API/socket layer;
 * this just renders the countdown and computes a clock-skew offset so the client's
 * local clock drift doesn't matter. The server independently rejects any submission
 * that arrives after `endsAt` regardless of what this timer displays.
 */
export function CountdownTimer({
  endsAt,
  serverNow,
  onExpire,
}: {
  endsAt: string;
  serverNow: string;
  onExpire?: () => void;
}) {
  const [offsetMs] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [remainingMs, setRemainingMs] = useState(() => new Date(endsAt).getTime() - (Date.now() + offsetMs));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(endsAt).getTime() - (Date.now() + offsetMs);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [endsAt, offsetMs, onExpire]);

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="text-center" data-testid="countdown-timer">
      <div
        className={`text-7xl font-black tabular-nums ${totalSeconds <= 5 ? 'text-red-500 animate-pulse' : 'text-primary-400'}`}
      >
        {display}
      </div>
      <div className="text-sm uppercase tracking-widest text-slate-400 mt-1">time remaining</div>
    </div>
  );
}
