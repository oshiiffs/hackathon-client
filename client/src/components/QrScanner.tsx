import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const ELEMENT_ID = 'qr-scanner-region';

export function QrScanner({
  onScan,
  onError,
  paused,
}: {
  onScan: (decodedText: string) => void;
  onError?: (message: string) => void;
  paused?: boolean;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false });
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!stopped) onScanRef.current(decodedText);
        },
        () => {
          /* ignore per-frame "not found" noise */
        },
      )
      .catch((err) => {
        // Camera permission denied, no camera present, or already in use —
        // html5-qrcode surfaces all of these as a rejected start() promise.
        console.error('Failed to start QR scanner (camera permission denied?):', err);
        onErrorRef.current?.(err instanceof Error ? err.message : 'Camera unavailable.');
      });

    return () => {
      stopped = true;
      scanner.stop().then(() => scanner.clear()).catch(() => {
        /* already stopped */
      });
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    if (paused && scanner.getState() === 2 /* SCANNING */) {
      scanner.pause(true);
    } else if (!paused && scanner.getState() === 3 /* PAUSED */) {
      scanner.resume();
    }
  }, [paused]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 bg-black">
      <div id={ELEMENT_ID} className="w-full" />
    </div>
  );
}
