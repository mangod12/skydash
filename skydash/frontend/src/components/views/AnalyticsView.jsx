import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';

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

function StatCard({ label, value, sub, color = 'text-indigo-400' }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-zinc-600 tracking-wider uppercase mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AnalyticsView() {
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);
  const history = useTelemetryStore((s) => s.history);
  const fleet = useTelemetryStore((s) => s.fleet);

  // Entity type distribution
  const typeData = Object.entries(
    entities.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Threat breakdown
  const threatData = Object.entries(
    entities.reduce((acc, e) => {
      acc[e.threatLevel] = (acc[e.threatLevel] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Top entities by event count
  const entityEventCounts = {};
  events.forEach((e) => {
    if (e.entityId) entityEventCounts[e.entityId] = (entityEventCounts[e.entityId] || 0) + 1;
  });
  const topEntities = Object.entries(entityEventCounts)
    .map(([id, count]) => ({
      name: entities.find((e) => e.id === id)?.name || id,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const highThreatCount = entities.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical').length;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Top stats row */}
        <div className="grid grid-cols-4 gap-3">
          <GlassCard className="!p-4">
            <StatCard label="TOTAL ENTITIES" value={entities.length} color="text-indigo-400" />
          </GlassCard>
          <GlassCard className="!p-4">
            <StatCard label="ACTIVE EVENTS" value={events.length} color="text-cyan-400" />
          </GlassCard>
          <GlassCard className="!p-4">
            <StatCard label="HIGH THREAT" value={highThreatCount} color={highThreatCount > 0 ? 'text-red-400' : 'text-emerald-400'} />
          </GlassCard>
          <GlassCard className="!p-4">
            <StatCard label="ACTIVE DRONES" value={fleet.length || 1} color="text-violet-400" />
          </GlassCard>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Entity type distribution */}
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

          {/* Threat breakdown */}
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

          {/* Telemetry history */}
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
        </div>

        {/* Top entities + Fleet status */}
        <div className="grid grid-cols-2 gap-3">
          <GlassCard>
            <SectionLabel>TOP ENTITIES BY ACTIVITY</SectionLabel>
            {topEntities.length > 0 ? (
              <div className="space-y-2">
                {topEntities.map((e, i) => (
                  <div key={e.name} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-600 w-4">{i + 1}.</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-zinc-300 truncate">{e.name}</span>
                      <div className="flex-1 h-1 rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-indigo-500/60"
                          style={{ width: `${(e.count / topEntities[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{e.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-700 text-[10px] text-center py-6">NO ACTIVITY</div>
            )}
          </GlassCard>

          <GlassCard>
            <SectionLabel>FLEET STATUS</SectionLabel>
            {(fleet.length > 0 ? fleet : [{ drone_id: 'DRONE-01', flight_mode: '--', altitude: 0, battery_voltage: 0, signal_strength: 0 }])
              .map((drone) => (
                <div key={drone.drone_id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono text-zinc-300">{drone.drone_id}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums text-zinc-500">
                    <span>{drone.flight_mode}</span>
                    <span className="text-emerald-400">{drone.altitude?.toFixed(0) ?? '--'}m</span>
                    <span>{drone.battery_voltage?.toFixed(1) ?? '--'}V</span>
                    <span>{drone.signal_strength ?? '--'}%</span>
                  </div>
                </div>
              ))}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
