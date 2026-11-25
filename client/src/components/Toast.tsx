import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

export type ToastKind = 'success' | 'error';

interface ToastProps {
  message: string;
  kind?: ToastKind;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, kind = 'success', onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onCloseRef.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  const Icon = kind === 'success' ? Check : AlertCircle;
  const color = kind === 'success' ? 'text-success' : 'text-danger';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fade-in-up fixed left-1/2 top-4 z-50 flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-btn bg-surface px-4 py-3 shadow-card"
    >
      <Icon className={color} size={20} aria-hidden />
      <p className="flex-1 text-[15px] leading-5">{message}</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          onClose();
        }}
        className="rounded-md p-1 text-ink-muted transition-colors hover:text-ink"
        aria-label="Закрыть уведомление"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);

  const show = (message: string, kind: ToastKind = 'success') => setToast({ message, kind });
  const hide = () => setToast(null);

  const node = toast ? <Toast message={toast.message} kind={toast.kind} onClose={hide} /> : null;

  return { show, hide, node };
}
