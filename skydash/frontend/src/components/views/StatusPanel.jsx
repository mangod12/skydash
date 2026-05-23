import { useState, useEffect } from 'react';
import { Plane, Shield, Gauge, Target, Wifi, WifiOff } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';

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
    { label: 'ENTITIES', value: entities.length, sub: 'TRACKED', icon: Shield, color: 'text-violet-400' },
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
