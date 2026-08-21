import { useToastStore } from '../store/toastStore';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`rounded-lg px-4 py-3 shadow-[4px_4px_0px_#111111] text-sm font-bold flex items-start gap-2 border-[3px] border-ink ${
            toast.kind === 'success' ? 'bg-lime text-ink' : 'bg-crimson text-ink'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => dismiss(toast.id)} className="text-xs opacity-70 hover:opacity-100 font-black">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
