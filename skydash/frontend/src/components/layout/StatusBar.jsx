import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';
import StatusBadge from '../common/StatusBadge';

export default function StatusBar() {
  const { data, isConnected, latency } = useTelemetryStore();
  const isMobile = useUIStore((s) => s.isMobile);

  const lat = data?.gps?.latitude?.toFixed(6) ?? '--';
  const lng = data?.gps?.longitude?.toFixed(6) ?? '--';

  if (isMobile) {
    return (
      <footer className="h-7 flex items-center justify-center px-4 border-t border-white/[0.06] bg-[var(--surface-0)] text-[10px] font-mono shrink-0 z-20">
        <div className="flex items-center gap-4">
          <StatusBadge
            status={isConnected ? 'connected' : 'disconnected'}
            label={isConnected ? 'CONNECTED' : 'OFFLINE'}
            pulse={isConnected}
          />
          {isConnected && (
            <span className="text-zinc-600 tabular-nums">{latency}ms</span>
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer className="h-7 flex items-center justify-between px-4 border-t border-white/[0.06] bg-[var(--surface-0)] text-[10px] font-mono shrink-0 z-20">
      {/* Left: Connection */}
      <div className="flex items-center gap-4">
        <StatusBadge
          status={isConnected ? 'connected' : 'disconnected'}
          label={isConnected ? 'CONNECTED' : 'OFFLINE'}
          pulse={isConnected}
        />
        {isConnected && (
          <span className="text-zinc-600 tabular-nums">{latency}ms</span>
        )}
      </div>

      {/* Center: Coordinates */}
      <div className="text-zinc-500 tabular-nums tracking-wider">
        {lat}, {lng}
      </div>

      {/* Right: Data rate */}
      <div className="flex items-center gap-3 text-zinc-600">
        <span>{data?.gps?.satellites ?? '--'} SATS</span>
        <span>{data?.flight_mode ?? '--'}</span>
      </div>
    </footer>
  );
}
