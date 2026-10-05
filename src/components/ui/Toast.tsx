import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { XIcon } from './icons';
import styles from './Toast.module.css';

export type ToastTone = 'neutral' | 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

type ToastInput = string | { message: string; tone?: ToastTone };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const entry: Toast = {
        id: nextId.current++,
        message: typeof toast === 'string' ? toast : toast.message,
        tone: typeof toast === 'string' ? 'success' : (toast.tone ?? 'success'),
      };
      setToasts((current) => [...current, entry]);
      setTimeout(() => dismiss(entry.id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div className={styles.region} role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
              <span>{toast.message}</span>
              <button
                type="button"
                className={styles.close}
                onClick={() => dismiss(toast.id)}
                aria-label="Tutup notifikasi"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
