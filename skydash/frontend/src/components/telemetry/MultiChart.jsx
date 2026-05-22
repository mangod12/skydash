import { useState } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';

const CHART_CONFIGS = [
  { id: 'altitude', label: 'ALT', dataKey: 'altitude', color: '#10b981', unit: 'm' },
  { id: 'speed', label: 'SPD', dataKey: 'speed', color: '#3b82f6', unit: 'm/s' },
  { id: 'battery', label: 'BAT', dataKey: 'battery', color: '#f59e0b', unit: 'V' },
  { id: 'signal', label: 'SIG', dataKey: 'signal', color: '#8b5cf6', unit: '%' },
];

function ChartTooltip({ active, payload, config }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs backdrop-blur-sm">
      <span className="font-mono tabular-nums" style={{ color: config.color }}>
        {payload[0].value?.toFixed(1)}{config.unit}
      </span>
    </div>
  );
}

export default function MultiChart() {
  const history = useTelemetryStore((s) => s.history);
  const [activeChart, setActiveChart] = useState('altitude');

  const config = CHART_CONFIGS.find((c) => c.id === activeChart);

  return (
    <div className="space-y-2">
      {/* Tab selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {CHART_CONFIGS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChart(c.id)}
              className={clsx(
                'px-2 py-1 rounded text-[9px] font-semibold tracking-[0.1em] transition-all duration-150',
                activeChart === c.id
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-400',
              )}
              style={activeChart === c.id ? {
                backgroundColor: `${c.color}20`,
                color: c.color,
              } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-[9px] font-mono tabular-nums text-zinc-700">
          {history.length} pts
        </span>
      </div>

      {/* Chart */}
      <div className="h-[120px]">
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.03)"
                vertical={false}
              />
              <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#3f3f46', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<ChartTooltip config={config} />} />
              <Area
                type="monotone"
                dataKey={config.dataKey}
                stroke={config.color}
                strokeWidth={1.5}
                fill={`url(#grad-${config.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-zinc-700 text-[10px] tracking-wider">AWAITING DATA...</span>
          </div>
        )}
      </div>
    </div>
  );
}
