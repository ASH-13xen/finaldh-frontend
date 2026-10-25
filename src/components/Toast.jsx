import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Lightweight toast notifications, replacing window.alert() (which blocks the page and looks broken on
// mobile). Wrap a screen in <ToastProvider> and call const toast = useToast(); toast.error('...').
const ToastContext = createContext(null);

const STYLES = {
  success: 'bg-status-success-bg border-status-success-text/40 text-status-success-text',
  error: 'bg-status-danger-bg border-status-danger-text/40 text-status-danger-text',
  info: 'bg-surface border-border-default text-text-primary'
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message, ms = 4500) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-3), { id, type, message }]);
    if (ms > 0) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, ms) => push('success', m, ms),
    error: (m, ms) => push('error', m, ms ?? 7000),
    info: (m, ms) => push('info', m, ms),
    dismiss
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Top-right: bottom-centre used to cover the primary "Save & next" button while a toast was showing */}
      <div className="fixed top-20 right-3 sm:right-5 z-[200] flex flex-col gap-2 w-[min(94vw,24rem)] pointer-events-none" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 border rounded-xl px-4 py-3 shadow-xl text-sm font-semibold ${STYLES[t.type]}`}>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100 cursor-pointer" aria-label="Dismiss">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Falls back to a no-op-ish console logger if used outside a provider, so a missing wrapper never crashes a screen.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || { success: console.log, error: console.error, info: console.log, dismiss: () => {} };
}
