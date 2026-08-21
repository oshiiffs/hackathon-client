import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

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
      // scanner.stop()/clear() THROW SYNCHRONOUSLY (not a rejected promise —
      // see html5-qrcode's Html5Qrcode.prototype.stop) if the scanner never
      // reached SCANNING/PAUSED — e.g. the camera permission prompt was
      // denied or there's no camera at all, which rejects start() above,
      // which sets cameraError in the parent, which immediately unmounts
      // this component in the same tick. That synchronous throw happens
      // inside a cleanup callback, which React has no error boundary for on
      // this app's root — left unguarded it takes down the entire page to a
      // blank white screen instead of just failing to clean up a scanner
      // that was never running. try/catch is the fix, not a state check
      // alone: isScanning() covers this correctly, but wrapping it too means
      // a change to that internal check can never reopen this crash.
      try {
        const state = scanner.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          scanner.stop().then(() => scanner.clear()).catch(() => {
            /* already stopped */
          });
        }
      } catch {
        /* never started — nothing to tear down */
      }
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (paused && scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        scanner.pause(true);
      } else if (!paused && scanner.getState() === Html5QrcodeScannerState.PAUSED) {
        scanner.resume();
      }
    } catch {
      /* scanner isn't in a pausable/resumable state (e.g. never started) — nothing to do */
    }
  }, [paused]);

  return (
    <div className="rounded-xl overflow-hidden border-[3px] border-ink shadow-[4px_4px_0px_#111111] bg-black">
      <div id={ELEMENT_ID} className="w-full" />
    </div>
  );
}
