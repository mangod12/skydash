import GlassCard from '../common/GlassCard';
import MetricDisplay from '../common/MetricDisplay';
import StatusBadge from '../common/StatusBadge';
import AttitudeIndicator from './AttitudeIndicator';
import BatteryGauge from './BatteryGauge';
import SignalMeter from './SignalMeter';
import GpsSkyView from './GpsSkyView';
import MultiChart from './MultiChart';
import { useTelemetryStore } from '../../stores/telemetryStore';

export default function TelemetryPanel() {
  const { data, isConnected, latency } = useTelemetryStore();

  return (
    <div className="h-full flex flex-col gap-2.5 p-3 overflow-y-auto">
      {/* Connection + Flight Mode */}
      <GlassCard className="!p-3">
        <div className="flex items-center justify-between">
          <StatusBadge
            status={isConnected ? 'connected' : 'disconnected'}
            label={isConnected ? 'LIVE' : 'OFFLINE'}
            pulse={isConnected}
          />
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-600 tabular-nums">
              {latency}ms
            </span>
            <StatusBadge
              status={data?.armed ? 'armed' : 'idle'}
              label={data?.flight_mode ?? '--'}
            />
          </div>
        </div>
      </GlassCard>

      {/* Primary Flight Display */}
      <GlassCard className="!p-4">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
          PRIMARY FLIGHT DISPLAY
        </h3>
        <div className="flex items-center gap-3">
          {/* Speed tape (left) */}
          <div className="flex flex-col items-center">
            <div className="text-[8px] text-zinc-600 tracking-wider mb-1">SPD</div>
            <div className="w-10 h-24 rounded border border-white/[0.06] bg-zinc-900/60 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-mono font-bold tabular-nums text-blue-400 bg-zinc-900/90 px-1 rounded z-10">
                  {data?.ground_speed?.toFixed(1) ?? '--'}
                </span>
              </div>
            </div>
            <div className="text-[7px] text-zinc-700 mt-0.5">m/s</div>
          </div>

          {/* Attitude indicator (center) */}
          <div className="flex-1">
            <AttitudeIndicator />
          </div>

          {/* Altitude tape (right) */}
          <div className="flex flex-col items-center">
            <div className="text-[8px] text-zinc-600 tracking-wider mb-1">ALT</div>
            <div className="w-10 h-24 rounded border border-white/[0.06] bg-zinc-900/60 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-mono font-bold tabular-nums text-emerald-400 bg-zinc-900/90 px-1 rounded z-10">
                  {data?.altitude?.toFixed(1) ?? '--'}
                </span>
              </div>
            </div>
            <div className="text-[7px] text-zinc-700 mt-0.5">m MSL</div>
          </div>
        </div>

        {/* Attitude numbers below */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          <MetricDisplay
            label="ROLL" value={data?.attitude?.roll?.toFixed(1)}
            unit="\u00B0" color="text-cyan-400" size="sm"
          />
          <MetricDisplay
            label="PITCH" value={data?.attitude?.pitch?.toFixed(1)}
            unit="\u00B0" color="text-blue-400" size="sm"
          />
          <MetricDisplay
            label="YAW" value={data?.attitude?.yaw?.toFixed(0)}
            unit="\u00B0" color="text-zinc-400" size="sm"
          />
        </div>
      </GlassCard>

      {/* Battery + Signal row */}
      <div className="grid grid-cols-2 gap-2.5">
        <GlassCard>
          <BatteryGauge />
        </GlassCard>
        <GlassCard>
          <SignalMeter />
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <GpsSkyView />
          </div>
        </GlassCard>
      </div>

      {/* Multi-chart */}
      <GlassCard>
        <MultiChart />
      </GlassCard>
    </div>
  );
}
