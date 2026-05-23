import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { COLORS } from '../../utils/designTokens';

const SPARK_POINTS = 20;

function batteryColor(pct) {
  if (pct < 15) return COLORS.critical;
  if (pct < 30) return COLORS.warning;
  return COLORS.healthy;
}

function generateHistory(drone) {
  const alt = drone.altitude ?? 0;
  const bat = drone.battery_percentage ?? 50;
  return Array.from({ length: SPARK_POINTS }, (_, i) => {
    const noise = Math.sin(i * 0.7 + (drone.drone_id?.charCodeAt(0) || 0)) * 5;
    const trend = (i / SPARK_POINTS) * 3;
    return {
      alt: Math.max(0, alt + noise - trend + (i * 0.2)),
      bat: Math.max(0, Math.min(100, bat + 2 - (i * 0.15) + Math.sin(i * 0.5) * 1.5)),
    };
  });
}

function Spark({ data, dataKey, color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-zinc-600 w-6 shrink-0 uppercase tracking-wider">
        {label}
      </span>
      <div className="w-[120px] h-[28px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function FleetSparklines() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const history = useTelemetryStore((s) => s.history);

  const drones = fleet.length > 0
    ? fleet
    : [{ drone_id: 'AWAITING', altitude: 0, battery_percentage: 0 }];

  const sparkData = useMemo(() => {
    return drones.map((drone) => ({
      id: drone.drone_id,
      history: history.length >= SPARK_POINTS
        ? history.slice(-SPARK_POINTS).map((h) => ({ alt: h.altitude, bat: h.battery }))
        : generateHistory(drone),
      batPct: drone.battery_percentage ?? 50,
    }));
  }, [drones, history]);

  return (
    <div className="space-y-3">
      {sparkData.map(({ id, history: data, batPct }) => (
        <div key={id} className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-semibold text-zinc-400 w-20 truncate">
            {id}
          </span>
          <div className="flex items-center gap-4">
            <Spark data={data} dataKey="alt" color={COLORS.dataLight} label="ALT" />
            <Spark data={data} dataKey="bat" color={batteryColor(batPct)} label="BAT" />
          </div>
        </div>
      ))}
    </div>
  );
}
