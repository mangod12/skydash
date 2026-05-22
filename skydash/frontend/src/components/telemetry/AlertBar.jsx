import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';

const SEVERITY_STYLES = {
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  critical: 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

export default function AlertBar() {
  const alerts = useTelemetryStore((s) => s.alerts);
  const clearAlerts = useTelemetryStore((s) => s.clearAlerts);

  if (alerts.length === 0) return null;

  // Show highest severity alert
  const topAlert = alerts.find((a) => a.severity === 'critical') || alerts[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="shrink-0"
      >
        <div className={clsx(
          'mx-3 mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-3',
          SEVERITY_STYLES[topAlert.severity],
        )}>
          <AlertTriangle size={16} className="shrink-0" />
          <span className="text-xs font-semibold tracking-wider flex-1">
            {topAlert.message}
          </span>
          <button
            onClick={clearAlerts}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
