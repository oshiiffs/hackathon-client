import { create } from 'zustand';

type ToastKind = 'success' | 'error';
type Toast = { id: string; kind: ToastKind; message: string };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
};

const AUTO_DISMISS_MS = 4500;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function showSuccessToast(message: string) {
  useToastStore.getState().push('success', message);
}

export function showErrorToast(message: string) {
  useToastStore.getState().push('error', message);
}
