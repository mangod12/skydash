import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { BACKEND_CONFIGURED } from '../../utils/runtimeConfig';

export default function ConnectionLost() {
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const [showOverlay, setShowOverlay] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Only show after 5s of continuous disconnection (avoids flash during reconnect)
  useEffect(() => {
    if (!BACKEND_CONFIGURED) return undefined;

    if (!isConnected) {
      const timer = setTimeout(() => setShowOverlay(!dismissed), 5000);
      return () => clearTimeout(timer);
    }
    // Connected - hide banner via timeout cleanup + explicit reset
    const id = setTimeout(() => {
      setDismissed(false);
      setShowOverlay(false);
    }, 0);
    return () => clearTimeout(id);
  }, [dismissed, isConnected]);

  if (!BACKEND_CONFIGURED) return null;

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-16 left-3 right-3 z-[80] flex justify-center pointer-events-none md:left-auto md:right-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            role="status"
            className="pointer-events-auto bg-zinc-900/95 border border-red-500/20 rounded-2xl p-4 max-w-md shadow-[0_0_40px_rgba(239,68,68,0.1)]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <WifiOff size={20} className="text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-semibold tracking-wider text-zinc-200">CONNECTION LOST</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Telemetry is reconnecting. Cached views, settings, and logs remain available.
                </p>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" />
                    Reconnecting
                  </span>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    RETRY NOW
                  </button>
                </div>
              </div>
              <button
                onClick={() => { setDismissed(true); setShowOverlay(false); }}
                aria-label="Dismiss connection warning"
                className="min-h-8 min-w-8 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
