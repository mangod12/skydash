import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import GlassCard from '../common/GlassCard';

const TYPE_COLORS = {
  person: '#8b5cf6',
  vehicle: '#3b82f6',
  building: '#f59e0b',
  device: '#22d3ee',
  event: '#ef4444',
};

const THREAT_COLORS = {
  none: '#71717a',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

function SectionLabel({ children }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
      {children}
    </h3>
  );
}

export function EntityDistributionChart({ typeData }) {
  return (
    <GlassCard>
      <SectionLabel>ENTITY DISTRIBUTION</SectionLabel>
      <div className="h-[180px] flex items-center justify-center">
        {typeData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {typeData.map((entry) => (
                  <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || '#71717a'} />
                ))}
              </Pie>
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="bg-zinc-900/90 border border-white/[0.08] rounded px-2 py-1 text-[10px] font-mono">
                      {payload[0].name}: {payload[0].value}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <span className="text-zinc-700 text-[10px]">NO DATA</span>
        )}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {typeData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[d.name] }} />
            <span className="text-[9px] text-zinc-500 uppercase">{d.name}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export function ThreatBreakdownChart({ threatData }) {
  return (
    <GlassCard>
      <SectionLabel>THREAT BREAKDOWN</SectionLabel>
      <div className="h-[180px]">
        {threatData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={threatData} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#a1a1aa', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {threatData.map((entry) => (
                  <Cell key={entry.name} fill={THREAT_COLORS[entry.name] || '#71717a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-zinc-700 text-[10px]">NO DATA</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export function AltitudeTrendChart({ history }) {
  return (
    <GlassCard>
      <SectionLabel>ALTITUDE TREND</SectionLabel>
      <div className="h-[180px]">
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="altAnalytics" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <YAxis
                tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false} width={30}
                domain={['auto', 'auto']}
              />
              <Area
                type="monotone"
                dataKey="altitude"
                stroke="#10b981"
                strokeWidth={1.5}
                fill="url(#altAnalytics)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-zinc-700 text-[10px]">AWAITING DATA</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
