import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { BACKEND_CONFIGURED } from '../../utils/runtimeConfig';
import { formatAge } from '../../utils/formatAge';

/**
 * Degraded-mode banner. Appears after 5s of continuous disconnection so a
 * quick reconnect does not flash. It cannot be dismissed: operators must always
 * know the data on screen is no longer live. The last-known state stays
 * visible underneath; the banner says how old it is. Reconnection is automatic
 * (exponential backoff), so there is no reload button that would discard it.
 */
export default function ConnectionLost() {
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const lastUpdate = useTelemetryStore((s) => s.lastUpdate);
  const [lostAt, setLostAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!BACKEND_CONFIGURED) return undefined;
    if (isConnected) {
      const id = setTimeout(() => setLostAt(null), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setLostAt((v) => v ?? Date.now()), 5000);
    return () => clearTimeout(id);
  }, [isConnected]);

  useEffect(() => {
    if (lostAt == null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lostAt]);

  if (!BACKEND_CONFIGURED || lostAt == null) return null;

  const lastTime = lastUpdate
    ? new Date(lastUpdate).toISOString().slice(11, 19) + 'Z'
    : null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-1.5 border-b border-red-500/30 bg-red-500/10 text-[11px] font-mono shrink-0"
    >
      <WifiOff size={13} className="text-red-400 shrink-0" />
      <span className="font-semibold tracking-[0.08em] text-red-300">TELEMETRY LINK LOST</span>
      <span className="text-zinc-400 truncate">
        {lastTime
          ? `Showing last known state from ${lastTime} (${formatAge(now - lastUpdate)} old). Data is not live.`
          : 'No telemetry received yet. Data is not live.'}
      </span>
      <span className="ml-auto text-zinc-500 shrink-0">Reconnecting automatically</span>
    </div>
  );
}
