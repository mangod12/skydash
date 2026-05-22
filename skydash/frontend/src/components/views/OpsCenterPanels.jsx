import { useMemo, useState, useEffect } from 'react';
import { Plane, Battery, Signal, Gauge, AlertTriangle, Shield, Wifi, WifiOff, Target } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';

const THREAT_COLORS = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
  critical: 'text-red-500',
};

const THREAT_BG = {
  low: 'bg-emerald-500/20 border-emerald-500/40',
  medium: 'bg-amber-500/20 border-amber-500/40',
  high: 'bg-red-500/20 border-red-500/40',
  critical: 'bg-red-600/30 border-red-500/60',
};

function DroneCard({ drone }) {
  const battery = drone.battery_percentage ?? Math.round(((drone.battery_voltage ?? 16.8) / 16.8) * 100);
  const batteryColor = battery > 60 ? 'text-emerald-400' : battery > 30 ? 'text-amber-400' : 'text-red-400';
  const signal = drone.signal_strength ?? 0;
  const signalColor = signal > 70 ? 'text-emerald-400' : signal > 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="border border-white/[0.08] rounded-xl bg-zinc-900/60 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane size={18} className="text-cyan-400" />
          <span className="text-sm font-bold tracking-wider text-zinc-100">
            {drone.drone_id || 'UNKNOWN'}
          </span>
        </div>
        <span className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase">
          {drone.pattern || 'idle'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">ALTITUDE</span>
          <div className="text-lg font-mono font-bold text-cyan-400">
            {Math.round(drone.altitude ?? 0)}m
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">SPEED</span>
          <div className="text-lg font-mono font-bold text-zinc-100">
            {(drone.ground_speed ?? 0).toFixed(1)} m/s
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">BATTERY</span>
          <div className={`text-lg font-mono font-bold ${batteryColor} flex items-center gap-1`}>
            <Battery size={14} /> {battery}%
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">SIGNAL</span>
          <div className={`text-lg font-mono font-bold ${signalColor} flex items-center gap-1`}>
            <Signal size={14} /> {signal}%
          </div>
        </div>
      </div>
    </div>
  );
}

export function FleetPanel() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const isConnected = useTelemetryStore((s) => s.isConnected);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400">FLEET STATUS</span>
        <span className={`text-[9px] font-mono ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {fleet.length === 0 && (
          <div className="text-center text-zinc-600 text-sm py-8">NO FLEET DATA</div>
        )}
        {fleet.map((drone) => (
          <DroneCard key={drone.drone_id} drone={drone} />
        ))}
      </div>
    </div>
  );
}

export function ThreatPanel() {
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);

  const threatCounts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0, critical: 0 };
    entities.forEach((e) => { if (c[e.threatLevel] !== undefined) c[e.threatLevel]++; });
    return c;
  }, [entities]);

  const maxThreat = threatCounts.critical > 0 ? 'critical'
    : threatCounts.high > 0 ? 'high'
    : threatCounts.medium > 0 ? 'medium' : 'low';

  const recentEvents = useMemo(
    () => [...events].sort((a, b) => b.time - a.time).slice(0, 8),
    [events],
  );

  return (
    <div className="h-full flex flex-col">
      <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 mb-3">THREAT FEED</span>

      {/* Threat Level Gauge */}
      <div className={`border rounded-xl p-4 mb-3 text-center ${THREAT_BG[maxThreat]}`}>
        <Shield size={24} className={`mx-auto mb-1 ${THREAT_COLORS[maxThreat]}`} />
        <div className={`text-2xl font-bold font-mono tracking-wider ${THREAT_COLORS[maxThreat]}`}>
          {maxThreat.toUpperCase()}
        </div>
        <div className="text-[9px] text-zinc-400 mt-1 tracking-wider">
          {threatCounts.critical}C / {threatCounts.high}H / {threatCounts.medium}M / {threatCounts.low}L
        </div>
      </div>

      {/* Scrolling Event Feed */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {recentEvents.map((evt) => (
          <div key={evt.id} className="border border-white/[0.06] rounded-lg p-2.5 bg-zinc-900/40">
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className={
                evt.severity === 'critical' ? 'text-red-400 mt-0.5' :
                evt.severity === 'warning' ? 'text-amber-400 mt-0.5' : 'text-zinc-500 mt-0.5'
              } />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200 leading-tight truncate">{evt.description}</p>
                <span className="text-[9px] text-zinc-600 font-mono">
                  {new Date(evt.time).toLocaleTimeString('en-US', { hour12: false })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusPanel() {
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const latency = useTelemetryStore((s) => s.latency);
  const fleet = useTelemetryStore((s) => s.fleet);
  const entities = useIntelStore((s) => s.entities);
  const missions = useMissionStore((s) => s.missions);

  const activeMissions = missions.filter((m) => m.status === 'active');
  const [uptime, setUptime] = useState('0h 0m');
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      setUptime(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: 'MISSIONS', value: activeMissions.length, sub: `${missions.length} TOTAL`, icon: Target, color: 'text-indigo-400' },
    { label: 'ENTITIES', value: entities.length, sub: `TRACKED`, icon: Shield, color: 'text-violet-400' },
    { label: 'DRONES', value: fleet.length, sub: 'IN FLEET', icon: Plane, color: 'text-cyan-400' },
    { label: 'LATENCY', value: `${latency}ms`, sub: 'ROUND TRIP', icon: Gauge, color: 'text-amber-400' },
  ];

  return (
    <div className="h-full flex flex-col">
      <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 mb-3">SYSTEM STATUS</span>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="border border-white/[0.08] rounded-xl bg-zinc-900/60 p-3 text-center">
            <Icon size={16} className={`mx-auto mb-1 ${color}`} />
            <div className="text-xl font-mono font-bold text-zinc-100">{value}</div>
            <div className="text-[9px] tracking-[0.15em] text-zinc-500">{label}</div>
            <div className="text-[8px] text-zinc-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Connection + Uptime */}
      <div className="border border-white/[0.08] rounded-xl bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">CONNECTION</span>
          <div className="flex items-center gap-1.5">
            {isConnected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-red-400" />}
            <span className={`text-xs font-mono font-bold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">UPTIME</span>
          <span className="text-xs font-mono font-bold text-zinc-200">{uptime}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] tracking-[0.15em] text-zinc-500">DATA RATE</span>
          <span className="text-xs font-mono font-bold text-cyan-400">{fleet.length * 2} msg/s</span>
        </div>
      </div>
    </div>
  );
}
