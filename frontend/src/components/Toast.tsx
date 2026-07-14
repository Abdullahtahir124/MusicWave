import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../store/toastStore';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col gap-3 pointer-events-none px-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className="toast-enter pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl shadow-black/30 text-sm font-medium min-w-[280px] max-w-[90vw]"
          style={{
            borderColor: t.type === 'error' ? '#f87171' : t.type === 'success' ? 'var(--accent)' : 'rgba(148,163,184,0.25)',
            background: t.type === 'error' ? 'rgba(248,113,113,0.95)' : t.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(15,23,42,0.92)',
          }}
        >
          {t.type === 'success' && <CheckCircle size={16} color="white" />}
          {t.type === 'error'   && <AlertCircle size={16} color="white" />}
          {t.type === 'info'    && <Info size={16} color="white" />}
          <span className="flex-1 text-white/95">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-white/70 hover:text-white transition-colors" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
