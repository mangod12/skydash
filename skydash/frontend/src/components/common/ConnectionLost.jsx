import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';

export default function ConnectionLost() {
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const [showOverlay, setShowOverlay] = useState(false);

  // Only show after 5s of continuous disconnection (avoids flash during reconnect)
  useEffect(() => {
    if (!isConnected) {
      const timer = setTimeout(() => setShowOverlay(true), 5000);
      return () => clearTimeout(timer);
    }
    // Connected — hide overlay via timeout cleanup + explicit reset
    const id = setTimeout(() => setShowOverlay(false), 0);
    return () => clearTimeout(id);
  }, [isConnected]);

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            className="bg-zinc-900/95 border border-red-500/20 rounded-2xl p-8 max-w-sm text-center shadow-[0_0_40px_rgba(239,68,68,0.1)]"
          >
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <WifiOff size={24} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">CONNECTION LOST</h3>
            <p className="text-[11px] text-zinc-500 mb-4">
              Telemetry stream disconnected. Attempting to reconnect...
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600">
              <RefreshCw size={12} className="animate-spin" />
              <span>Reconnecting...</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
