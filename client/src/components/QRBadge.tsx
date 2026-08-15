import { QRCodeSVG } from 'qrcode.react';
import { DEPARTMENT_COLORS } from '../lib/departmentColors';
import type { Department } from '../types/api';

export function QRBadge({ qrPayload, fullName, homeDepartment }: { qrPayload: string; fullName: string; homeDepartment: string }) {
  const accent = DEPARTMENT_COLORS[homeDepartment as Department] ?? '#64748b';
  return (
    <div
      className="bg-white rounded-2xl p-6 pt-5 shadow-xl flex flex-col items-center gap-4 max-w-xs mx-auto border-t-[6px]"
      style={{ borderTopColor: accent }}
    >
      <QRCodeSVG value={qrPayload} size={220} level="M" includeMargin fgColor={accent} />
      <div className="text-center">
        <p className="text-slate-900 font-bold text-lg">{fullName}</p>
        <p className="text-sm font-bold mt-0.5" style={{ color: accent }}>
          {homeDepartment}
        </p>
      </div>
      <p className="text-xs text-slate-400 text-center">
        Show this to a CEO to be scanned. It stops working the instant you&apos;re recruited.
      </p>
    </div>
  );
}
