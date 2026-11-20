/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react';
import { Shield, Wifi, WifiOff, Crosshair, Activity } from 'lucide-react';
import FleetSparklines from './FleetSparklines';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { ThreatGaugeWidget, EntityListWidget, FeedWidget, ClockWidget, WeatherWidget } from './WidgetItems';

/* ─── Stat Card Widget ─────────────────────────────────── */

const ACCENT_TEXT = {
  emerald: 'text-emerald-400', amber: 'text-amber-400',
  red: 'text-red-400', cyan: 'text-cyan-400', indigo: 'text-indigo-400',
};

function useStatData(metric) {
  const fleet = useTelemetryStore((s) => s.fleet);
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const latency = useTelemetryStore((s) => s.latency);
  const entities = useIntelStore((s) => s.entities);
  const missions = useMissionStore((s) => s.missions);

  return useMemo(() => {
    const avgBat = fleet.length > 0
      ? Math.round(fleet.reduce((s, d) => s + (d.battery_percentage ?? 0), 0) / fleet.length)
      : 0;
    const threats = { high: 0, critical: 0 };
    entities.forEach((e) => { if (threats[e.threatLevel] !== undefined) threats[e.threatLevel]++; });
    const active = missions.filter((m) => m.status === 'active');

    const map = {
      fleet: { label: 'FLEET STATUS', value: fleet.length, accent: fleet.length > 0 && isConnected ? 'emerald' : 'amber', sub: `${avgBat}% AVG BAT`, icon: Wifi },
      threat: { label: 'THREAT OVERVIEW', value: threats.high + threats.critical, accent: threats.critical > 0 ? 'red' : threats.high > 0 ? 'amber' : 'emerald', sub: `${threats.high} HIGH / ${threats.critical} CRIT`, icon: Shield },
      missions: { label: 'ACTIVE MISSIONS', value: active.length, accent: 'indigo', sub: `${entities.length} ENTITIES`, icon: Crosshair },
      system: { label: 'SYSTEM HEALTH', value: isConnected ? 'ONLINE' : 'OFFLINE', accent: isConnected ? 'cyan' : 'red', sub: `${latency}ms LATENCY`, icon: isConnected ? Activity : WifiOff },
    };
    return map[metric] || map.fleet;
  }, [fleet, isConnected, latency, entities, missions, metric]);
}

function StatCardWidget({ config }) {
  const data = useStatData(config?.metric || 'fleet');
  const Icon = data.icon;
  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">{data.label}</span>
        {Icon && <Icon size={14} className="text-zinc-600" />}
      </div>
      <div className={`text-2xl font-mono font-bold tabular-nums ${ACCENT_TEXT[data.accent] || 'text-zinc-200'}`}>
        {data.value}
      </div>
      <div className="text-[10px] text-zinc-500 mt-1 font-mono tabular-nums">{data.sub}</div>
    </div>
  );
}

/* ─── Mini Map Widget ──────────────────────────────────── */

function MiniMapWidget() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full h-full min-h-[120px] rounded-lg overflow-hidden border border-white/[0.08] bg-zinc-900/50 flex items-center justify-center">
        <span className="text-[10px] text-zinc-600 tracking-wider">MAP FEED</span>
      </div>
    </div>
  );
}

/* ─── Sparkline Widget ─────────────────────────────────── */

function SparklineWidget() {
  return <div className="h-full overflow-y-auto"><FleetSparklines limit={3} /></div>;
}

/* ─── Widget Map + Renderer ────────────────────────────── */

const WIDGET_MAP = {
  'stat-card': StatCardWidget,
  'mini-map': MiniMapWidget,
  'sparkline': SparklineWidget,
  'threat-gauge': ThreatGaugeWidget,
  'entity-list': EntityListWidget,
  'feed': FeedWidget,
  'clock': ClockWidget,
  'weather': WeatherWidget,
};

export const WIDGET_LABELS = {
  'stat-card': 'STAT CARD',
  'mini-map': 'MINI MAP',
  'sparkline': 'FLEET SNAPSHOT',
  'threat-gauge': 'THREAT GAUGE',
  'entity-list': 'ENTITY LIST',
  'feed': 'INTEL FEED',
  'clock': 'CLOCK',
  'weather': 'WEATHER',
};

export default function WidgetRenderer({ type, config }) {
  const Component = WIDGET_MAP[type];
  if (!Component) return <div className="text-[10px] text-zinc-600">UNKNOWN WIDGET</div>;
  return <Component config={config} />;
}
