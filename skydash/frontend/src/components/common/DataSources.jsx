import { useState, useEffect } from 'react';
import { Radio, Plane, Usb, Smartphone, Globe, Database } from 'lucide-react';
import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';

const STATUS_STYLES = {
  connected: { dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]', label: 'text-emerald-400', bar: 'bg-emerald-500' },
  degraded:  { dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]', label: 'text-amber-400', bar: 'bg-amber-500' },
  error:     { dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]', label: 'text-red-400', bar: 'bg-red-500' },
  available: { dot: 'bg-zinc-500', label: 'text-zinc-500', bar: 'bg-zinc-600' },
  planned:   { dot: 'bg-zinc-600', label: 'text-zinc-600', bar: 'bg-zinc-700' },
};

function formatTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toISOString().slice(11, 19) + 'Z';
}

function useDataSources() {
  const { isConnected, fleet, latency } = useTelemetryStore();
  const { entities, events } = useIntelStore();
  const { layers } = useMapStore();

  // Tick every second to keep lastFetch timestamps current
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fleetStatus = isConnected ? 'connected' : 'error';
  const droneCount = fleet.length || 0;
  const adsbActive = layers.adsb;

  const entitiesLastSeen = entities.length > 0
    ? Math.max(...entities.map((e) => e.lastSeen || 0))
    : null;

  return [
    {
      id: 'fleet',
      icon: Radio,
      name: 'FLEET SIMULATOR',
      status: fleetStatus,
      statusLabel: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      description: `${droneCount} drones · 10 Hz · ${latency}ms latency`,
      health: isConnected ? 100 : 0,
      lastFetch: isConnected ? now : null,
    },
    {
      id: 'adsb',
      icon: Plane,
      name: 'ADS-B (OPENSKY)',
      status: adsbActive ? 'connected' : 'available',
      statusLabel: adsbActive ? 'CONNECTED' : 'AVAILABLE',
      description: adsbActive ? '12 aircraft · 15s refresh' : 'Layer disabled in map settings',
      health: adsbActive ? 85 : 0,
      lastFetch: adsbActive ? now : null,
    },
    {
      id: 'mavlink',
      icon: Usb,
      name: 'MAVLINK',
      status: 'available',
      statusLabel: 'AVAILABLE',
      description: 'Serial/UDP · ArduPilot compatible',
      health: 0,
      note: 'Not configured',
      lastFetch: null,
    },
    {
      id: 'dji',
      icon: Smartphone,
      name: 'DJI SDK',
      status: 'available',
      statusLabel: 'AVAILABLE',
      description: 'Bridge server required',
      health: 0,
      note: 'Not configured',
      lastFetch: null,
    },
    {
      id: 'osint',
      icon: Globe,
      name: 'OSINT FEEDS',
      status: 'planned',
      statusLabel: 'PLANNED',
      description: 'Shodan · VirusTotal · Censys',
      health: 0,
      note: 'Coming soon',
      lastFetch: null,
    },
    {
      id: 'entities',
      icon: Database,
      name: 'ENTITY DATABASE',
      status: 'connected',
      statusLabel: 'CONNECTED',
      description: `SQLite · ${entities.length} entities · ${events.length} events`,
      health: 100,
      lastFetch: entitiesLastSeen,
    },
  ];
}

function SourceCard({ source }) {
  const styles = STATUS_STYLES[source.status] || STATUS_STYLES.available;
  const Icon = source.icon;
  const isActive = source.status === 'connected' || source.status === 'degraded';

  return (
    <div className="px-4 py-3 border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className={clsx('w-2 h-2 rounded-full shrink-0', styles.dot, isActive && 'animate-pulse')} />
          <Icon size={13} className="text-zinc-500" />
          <span className="text-[11px] font-semibold tracking-wider text-zinc-200">{source.name}</span>
        </div>
        <span className={clsx('text-[9px] font-bold tracking-widest', styles.label)}>
          {source.statusLabel}
        </span>
      </div>
      <p className="text-[10px] text-zinc-500 ml-[30px] mb-1.5 font-mono">{source.description}</p>
      <div className="ml-[30px] flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          {source.health > 0 ? (
            <div className={clsx('h-full rounded-full transition-all', styles.bar)} style={{ width: `${source.health}%` }} />
          ) : null}
        </div>
        <span className="text-[9px] text-zinc-600 font-mono w-20 text-right">
          {source.health > 0 ? `${source.health}%` : source.note || '—'}
        </span>
      </div>
      {source.lastFetch && (
        <div className="ml-[30px] mt-1">
          <span className="text-[8px] text-zinc-700 font-mono">
            Last fetch: {formatTimestamp(source.lastFetch)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DataSources() {
  const sources = useDataSources();

  return (
    <div>
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">DATA SOURCES</h3>
      <div className="bg-zinc-900/60 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
        {sources.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}
      </div>
    </div>
  );
}
