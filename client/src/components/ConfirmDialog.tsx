import { comicButton } from '../lib/comic';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm bg-white border-[3px] border-ink rounded-xl p-6 shadow-[8px_8px_0px_#111111]">
        <h2 className="text-lg font-black uppercase tracking-wide text-navy">{title}</h2>
        {description && <p className="mt-2 text-sm text-ink">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={pending} className={comicButton('white', 'sm')}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={pending} className={comicButton(tone === 'danger' ? 'crimson' : 'forest', 'sm')}>
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
