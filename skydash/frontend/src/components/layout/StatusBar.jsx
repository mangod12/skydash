import { useState, useRef, useEffect } from 'react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';
import StatusBadge from '../common/StatusBadge';
import SystemHealth from '../common/SystemHealth';

export default function StatusBar() {
  const { data, isConnected, latency } = useTelemetryStore();
  const isMobile = useUIStore((s) => s.isMobile);
  const [healthOpen, setHealthOpen] = useState(false);
  const popoverRef = useRef(null);

  const lat = data?.gps?.latitude?.toFixed(6) ?? '--';
  const lng = data?.gps?.longitude?.toFixed(6) ?? '--';

  useEffect(() => {
    if (!healthOpen) return;
    const onClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setHealthOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [healthOpen]);

  const connectionArea = (
    <button
      onClick={() => setHealthOpen((v) => !v)}
      className="flex items-center gap-4 hover:opacity-80 transition-opacity"
    >
      <StatusBadge
        status={isConnected ? 'connected' : 'disconnected'}
        label={isConnected ? 'CONNECTED' : 'OFFLINE'}
        pulse={isConnected}
      />
      {isConnected && (
        <span className="text-zinc-600 tabular-nums">{latency}ms</span>
      )}
    </button>
  );

  const popover = healthOpen && (
    <div ref={popoverRef} className="absolute bottom-8 left-2 w-[380px] z-50">
      <SystemHealth />
    </div>
  );

  if (isMobile) {
    return (
      <footer className="h-7 flex items-center justify-center px-4 border-t border-white/[0.06] bg-[var(--surface-0)] text-[10px] font-mono shrink-0 z-20 relative">
        {connectionArea}
        {popover}
      </footer>
    );
  }

  return (
    <footer className="h-7 flex items-center justify-between px-4 border-t border-white/[0.06] bg-[var(--surface-0)] text-[10px] font-mono shrink-0 z-20 relative">
      {/* Left: Connection (click to expand health) */}
      <div className="relative">
        {connectionArea}
        {popover}
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
