import { useMemo } from 'react';
import { User, Car, Building2, Radio, Zap } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { THREAT_COLORS } from '../../utils/designTokens';

const TYPE_CONFIG = {
  person:   { icon: User,      color: '#8b5cf6', label: 'PERSONS' },
  vehicle:  { icon: Car,       color: '#3b82f6', label: 'VEHICLES' },
  building: { icon: Building2, color: '#f59e0b', label: 'FACILITIES' },
  device:   { icon: Radio,     color: '#22d3ee', label: 'SIGNALS' },
  event:    { icon: Zap,       color: '#ef4444', label: 'EVENTS' },
};

function computeTypeStats(entities) {
  const types = {};

  entities.forEach((e) => {
    if (!types[e.type]) {
      types[e.type] = {
        count: 0,
        totalConfidence: 0,
        threats: { none: 0, low: 0, medium: 0, high: 0, critical: 0 },
        topEntity: null,
        maxThreat: 0,
      };
    }
    const t = types[e.type];
    t.count++;
    t.totalConfidence += e.confidence || 0;
    t.threats[e.threatLevel || 'none']++;

    const threatRank = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const rank = threatRank[e.threatLevel] || 0;
    if (rank > t.maxThreat || !t.topEntity) {
      t.maxThreat = rank;
      t.topEntity = e.name;
    }
  });

  return Object.entries(types).map(([type, stats]) => ({
    type,
    ...stats,
    avgConfidence: Math.round(stats.totalConfidence / stats.count),
  }));
}

function ThreatBar({ threats, total }) {
  const levels = ['critical', 'high', 'medium', 'low', 'none'];
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/50">
      {levels.map((level) => {
        const pct = total > 0 ? (threats[level] / total) * 100 : 0;
        if (pct === 0) return null;
        return (
          <div
            key={level}
            className="h-full"
            style={{ width: `${pct}%`, backgroundColor: THREAT_COLORS[level] }}
          />
        );
      })}
    </div>
  );
}

export default function EntityTypeCards({ entities }) {
  const typeStats = useMemo(() => computeTypeStats(entities), [entities]);

  return (
    <GlassCard>
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
        ENTITY TYPE BREAKDOWN
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {typeStats.map(({ type, count, avgConfidence, threats, topEntity }) => {
          const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.event;
          const Icon = cfg.icon;
          return (
            <div
              key={type}
              className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Icon size={14} style={{ color: cfg.color }} />
                <span className="text-[9px] font-semibold tracking-wider text-zinc-400">
                  {cfg.label}
                </span>
              </div>
              <div className="text-xl font-mono font-bold tabular-nums" style={{ color: cfg.color }}>
                {count}
              </div>
              <ThreatBar threats={threats} total={count} />
              <div className="space-y-0.5">
                <div className="text-[8px] text-zinc-600 font-mono">
                  CONF: <span className="text-zinc-400 tabular-nums">{avgConfidence}%</span>
                </div>
                <div className="text-[8px] text-zinc-600 font-mono truncate" title={topEntity}>
                  TOP: <span className="text-zinc-400">{topEntity}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
