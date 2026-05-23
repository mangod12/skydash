import { useMemo } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import GlassCard from '../common/GlassCard';
import { THREAT_COLORS } from '../../utils/designTokens';

const BUCKET_COUNT = 12;
const SEVERITY_MAP = { info: 'low', warning: 'medium', critical: 'critical' };

function bucketEvents(events) {
  if (events.length === 0) return [];

  const now = Date.now();
  const oldest = Math.min(...events.map((e) => e.time));
  const span = Math.max(now - oldest, 60000);
  const step = span / BUCKET_COUNT;

  const buckets = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    time: oldest + i * step,
    label: formatBucketTime(oldest + i * step),
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }));

  events.forEach((evt) => {
    const idx = Math.min(
      Math.floor((evt.time - oldest) / step),
      BUCKET_COUNT - 1,
    );
    const level = SEVERITY_MAP[evt.severity] || 'low';
    buckets[idx][level]++;
  });

  return buckets;
}

function formatBucketTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ChartTooltip({ payload, label }) {
  if (!payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 border border-white/[0.08] rounded-lg px-3 py-2 text-[10px] font-mono shadow-xl">
      <div className="text-zinc-500 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400 uppercase">{p.dataKey}</span>
          <span className="text-zinc-200 ml-auto tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ThreatTrendChart({ events }) {
  const data = useMemo(() => bucketEvents(events), [events]);

  return (
    <GlassCard>
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
        THREAT TIMELINE
      </h3>
      <div className="h-[200px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                {['low', 'medium', 'high', 'critical'].map((level) => (
                  <linearGradient key={level} id={`grad-${level}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THREAT_COLORS[level]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={THREAT_COLORS[level]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false} width={24}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="critical" stackId="1" stroke={THREAT_COLORS.critical} fill="url(#grad-critical)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="high" stackId="1" stroke={THREAT_COLORS.high} fill="url(#grad-high)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="medium" stackId="1" stroke={THREAT_COLORS.medium} fill="url(#grad-medium)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="low" stackId="1" stroke={THREAT_COLORS.low} fill="url(#grad-low)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-700 text-[10px]">
            NO EVENT DATA
          </div>
        )}
      </div>
    </GlassCard>
  );
}
