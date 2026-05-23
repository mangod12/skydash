import { Plane, Battery, Signal } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';

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
