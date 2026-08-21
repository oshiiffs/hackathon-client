import { QRCodeSVG } from 'qrcode.react';
import { DEPARTMENT_COLORS } from '../lib/departmentColors';
import type { Department } from '../types/api';

export function QRBadge({ qrPayload, fullName, homeDepartment }: { qrPayload: string; fullName: string; homeDepartment: string }) {
  const accent = DEPARTMENT_COLORS[homeDepartment as Department] ?? '#0E1D3E';
  return (
    <div className="relative bg-white rounded-xl p-6 pt-5 shadow-[6px_6px_0px_#111111] border-[3px] border-ink flex flex-col items-center gap-4 max-w-xs mx-auto">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-gold" aria-hidden="true" />
      <div className="w-full h-2 rounded-t-sm -mt-1 border-b-[3px] border-ink" style={{ backgroundColor: accent }} />
      <QRCodeSVG value={qrPayload} size={220} level="M" includeMargin fgColor="#111111" />
      <div className="text-center">
        <p className="text-ink font-black uppercase tracking-wide text-lg">{fullName}</p>
        <p className="text-sm font-black uppercase mt-0.5" style={{ color: accent }}>
          {homeDepartment}
        </p>
      </div>
      <p className="text-xs text-navy text-center">
        Show this to a CEO to be scanned. It stops working the instant you&apos;re recruited.
      </p>
    </div>
  );
}
