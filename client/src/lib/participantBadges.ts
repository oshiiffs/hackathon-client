import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export type ParticipantBadge = {
  id: string;
  fullName: string;
  homeDepartment: string;
  accessCode: string;
  qrPayload: string;
};

/**
 * Renders every participant's badge (QR code + name + department + access
 * code) onto a printable multi-page PDF and triggers a save — one PDF for
 * the whole roster, meant to go straight to a printer for lanyard cards,
 * rather than N separate image downloads (which browsers block/throttle
 * past a handful of concurrent auto-downloads from one click anyway).
 *
 * QR codes are generated headlessly via the `qrcode` package (not
 * qrcode.react, which only exposes a React component — no way to batch-
 * generate N of those without actually mounting N canvases into the DOM).
 */
export async function downloadParticipantBadgesPdf(badges: ParticipantBadge[]): Promise<void> {
  if (badges.length === 0) return;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const cols = 2;
  const rows = 4;
  const perPage = cols * rows;
  const cellW = (pageWidth - margin * 2) / cols;
  const cellH = (pageHeight - margin * 2) / rows;
  const qrSize = Math.min(cellW, cellH) * 0.55;

  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i]!;
    const indexOnPage = i % perPage;
    if (i > 0 && indexOnPage === 0) doc.addPage();

    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = margin + col * cellW;
    const y = margin + row * cellH;

    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.4);
    doc.rect(x + 2, y + 2, cellW - 4, cellH - 4);

    // eslint-disable-next-line no-await-in-loop -- sequential by design: one
    // PDF must contain every badge in a stable order, and this only runs
    // once per admin click, not on any hot path.
    const qrDataUrl = await QRCode.toDataURL(badge.qrPayload, { margin: 1, width: 300 });
    const qrX = x + (cellW - qrSize) / 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, y + 4, qrSize, qrSize);

    const textY = y + 4 + qrSize + 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(badge.fullName, x + cellW / 2, textY, { align: 'center', maxWidth: cellW - 8 });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(badge.homeDepartment, x + cellW / 2, textY + 5, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Code: ${badge.accessCode}`, x + cellW / 2, textY + 10, { align: 'center' });
  }

  doc.save(`participant-badges-${new Date().toISOString().slice(0, 10)}.pdf`);
}
