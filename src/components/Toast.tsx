import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; type: ToastType; message: string; }

const ToastContext = createContext<(type: ToastType, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2.5rem)] sm:w-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass-gold rounded-xl px-4 py-3 flex items-start gap-3 animate-fade-up shadow-glass"
          >
            {t.type === 'success' && <CheckCircle2 size={18} className="text-success-400 mt-0.5 shrink-0" />}
            {t.type === 'error' && <AlertCircle size={18} className="text-error-400 mt-0.5 shrink-0" />}
            {t.type === 'info' && <Info size={18} className="text-gold-400 mt-0.5 shrink-0" />}
            <p className="text-sm text-gray-100 flex-1">{t.message}</p>
            <button
              onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
              className="text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
