import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: AlertTriangle,
};

const COLORS = {
  success: 'border-emerald-500/30 text-emerald-400',
  warning: 'border-amber-500/30 text-amber-400',
  info: 'border-blue-500/30 text-blue-400',
  error: 'border-red-500/30 text-red-400',
};

// Global toast state
let addToastFn = null;
let toastId = 0;

export function toast(message, type = 'info', duration = 3000) {
  toastId += 1;
  addToastFn?.({ message, type, duration, id: `${Date.now()}-${toastId}` });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((t) => {
    setToasts((prev) => [...prev, t]);
    if (t.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    }
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-10 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={clsx(
                'pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-lg border',
                'bg-zinc-900/90 backdrop-blur-md shadow-lg max-w-xs',
                COLORS[t.type],
              )}
            >
              <Icon size={14} className="shrink-0" />
              <span className="text-xs text-zinc-300 flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="text-zinc-600 hover:text-zinc-400 shrink-0"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
