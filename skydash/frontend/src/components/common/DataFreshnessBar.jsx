import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';

const FRESHNESS_TIERS = [
  { max: 5000, label: 'LIVE', dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]', text: 'text-emerald-400', pulse: true },
  { max: 60000, label: 'RECENT', dot: 'bg-cyan-500', text: 'text-cyan-400', pulse: false },
  { max: 600000, label: 'STALE', dot: 'bg-amber-500', text: 'text-amber-400', pulse: false },
  { max: Infinity, label: 'OFFLINE', dot: 'bg-red-500', text: 'text-red-400', pulse: false },
];

function getTier(ageMs) {
  if (ageMs == null) return FRESHNESS_TIERS[FRESHNESS_TIERS.length - 1];
  return FRESHNESS_TIERS.find((t) => ageMs < t.max) || FRESHNESS_TIERS[FRESHNESS_TIERS.length - 1];
}

function useSourceTimestamps() {
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);
  const adsbActive = useMapStore((s) => s.layers.adsb);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const entityLastSeen = useMemo(() => {
    if (entities.length === 0) return null;
    return Math.max(...entities.map((e) => e.lastSeen || 0));
  }, [entities]);

  const intelLastEvent = useMemo(() => {
    if (events.length === 0) return null;
    return Math.max(...events.map((e) => e.time || 0));
  }, [events]);

  return [
    {
      id: 'telemetry',
      name: 'TELEMETRY WS',
      timestamp: isConnected ? now : null,
    },
    {
      id: 'entities',
      name: 'ENTITY DB',
      timestamp: entityLastSeen,
    },
    {
      id: 'adsb',
      name: 'ADS-B',
      timestamp: adsbActive ? now - 5000 : null,
    },
    {
      id: 'intel',
      name: 'INTEL FEED',
      timestamp: intelLastEvent,
    },
  ];
}

function SourceDot({ source, now, expanded }) {
  const ageMs = source.timestamp != null ? Math.max(0, now - source.timestamp) : null;
  const tier = getTier(ageMs);

  return (
    <div
      className="flex items-center gap-1.5"
      title={`${source.name}: ${tier.label}`}
    >
      <span
        className={clsx(
          'w-2 h-2 rounded-full shrink-0 transition-colors',
          tier.dot,
          tier.pulse && 'animate-pulse',
        )}
      />
      {expanded && (
        <>
          <span className="text-[9px] text-zinc-400 font-semibold tracking-wider whitespace-nowrap">
            {source.name}
          </span>
          <span className={clsx('text-[9px] font-mono tracking-wider', tier.text)}>
            {tier.label}
          </span>
        </>
      )}
    </div>
  );
}

export default function DataFreshnessBar({ className }) {
  const sources = useSourceTimestamps();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={clsx(
      'flex items-center gap-3 px-3 py-2 rounded-lg',
      'bg-white/[0.02] border border-white/[0.06]',
      className,
    )}>
      <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-600 shrink-0">
        DATA SOURCES
      </span>

      <div className="flex items-center gap-4 overflow-hidden">
        {sources.map((src) => (
          <SourceDot key={src.id} source={src} now={now} expanded />
        ))}
      </div>

      {/* Collapsed mode: just dots for narrow widths */}
      <div className="hidden max-[640px]:flex items-center gap-1.5">
        {sources.map((src) => (
          <SourceDot key={src.id} source={src} now={now} expanded={false} />
        ))}
      </div>
    </div>
  );
}
