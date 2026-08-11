import { QRCodeSVG } from 'qrcode.react';

export function QRBadge({ qrPayload, fullName, homeDepartment }: { qrPayload: string; fullName: string; homeDepartment: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 max-w-xs mx-auto">
      <QRCodeSVG value={qrPayload} size={220} level="M" includeMargin />
      <div className="text-center">
        <p className="text-slate-900 font-bold text-lg">{fullName}</p>
        <p className="text-slate-500 text-sm font-medium">{homeDepartment}</p>
      </div>
      <p className="text-xs text-slate-400 text-center">
        Show this to a CEO to be scanned. It stops working the instant you&apos;re recruited.
      </p>
    </div>
  );
}
