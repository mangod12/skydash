import {
  AreaChart, Area, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useTelemetryStore } from '../../stores/telemetryStore';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/90 border border-white/[0.08] rounded-lg px-3 py-2 text-xs backdrop-blur-sm">
      <span className="font-mono tabular-nums text-emerald-400">
        {payload[0].value?.toFixed(1)}m
      </span>
    </div>
  );
}

export default function AltitudeChart() {
  const history = useTelemetryStore((s) => s.history);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase">
          ALTITUDE HISTORY
        </span>
        <span className="text-[10px] font-mono tabular-nums text-zinc-600">
          {history.length} samples
        </span>
      </div>

      <div className="h-[140px]">
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="altitude"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#altGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-zinc-700 text-xs">Waiting for data...</span>
          </div>
        )}
      </div>
    </div>
  );
}
