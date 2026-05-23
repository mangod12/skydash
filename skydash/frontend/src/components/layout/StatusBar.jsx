import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';
import { useMissionStore } from '../../stores/missionStore';
import StatusBadge from '../common/StatusBadge';
import SystemHealth from '../common/SystemHealth';
import SystemPulse from '../common/SystemPulse';
import FreshnessIndicator from '../common/FreshnessIndicator';

function ConnectionBars({ latency, connected }) {
  const bars = connected
    ? (latency < 50 ? 5 : latency < 100 ? 4 : latency < 200 ? 3 : latency < 500 ? 2 : 1)
    : 0;
  const color = bars >= 4
    ? 'text-emerald-500'
    : bars >= 2
      ? 'text-amber-500'
      : 'text-red-500';

  return (
    <div className={clsx('flex items-end gap-px h-3', color)} aria-label={`Signal quality: ${bars} of 5 bars`}>
      {[3, 5, 7, 9, 11].map((h, i) => (
        <div
          key={i}
          className={clsx(
            'w-1 rounded-sm transition-all',
            i < bars ? 'bg-current' : 'bg-zinc-800',
          )}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function StatusBar() {
  const { data, isConnected, latency } = useTelemetryStore();
  const isMobile = useUIStore((s) => s.isMobile);
  const activeMission = useMissionStore((s) => s.getActiveMission());
  const [healthOpen, setHealthOpen] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');
  const popoverRef = useRef(null);

  const lat = data?.gps?.latitude?.toFixed(6) ?? '--';
  const lng = data?.gps?.longitude?.toFixed(6) ?? '--';

  // Mission elapsed timer
  useEffect(() => {
    if (!activeMission) return;
    const createdAt = new Date(activeMission.created_at).getTime();
    const tick = () => setElapsed(formatElapsed(Date.now() - createdAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeMission]);

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
      <div className="flex items-center gap-1.5">
        <ConnectionBars latency={latency} connected={isConnected} />
        {isConnected ? (
          <span className="text-zinc-600 tabular-nums">{latency}ms</span>
        ) : (
          <span className="text-red-500 text-[9px] font-bold tracking-wider">OFFLINE</span>
        )}
      </div>
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

      {/* Mission timer */}
      <div className="flex items-center gap-2 tabular-nums">
        {activeMission ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-zinc-300 uppercase tracking-wider truncate max-w-[120px]">
              {activeMission.name}
            </span>
            <span className="text-cyan-400">{elapsed}</span>
          </>
        ) : (
          <span className="text-zinc-600 tracking-wider">NO ACTIVE MISSION</span>
        )}
      </div>

      {/* System pulse + WS Freshness */}
      <div className="flex items-center gap-3 text-zinc-600">
        <SystemPulse />
        <FreshnessIndicator
          timestamp={isConnected ? Date.now() : null}
          source="WS"
          compact
        />
        <span>{data?.gps?.satellites ?? '--'} SATS</span>
      </div>
    </footer>
  );
}
