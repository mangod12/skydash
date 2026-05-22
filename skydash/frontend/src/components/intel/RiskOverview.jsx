import { useMemo } from 'react';
import { clsx } from 'clsx';
import { ShieldAlert } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';
import {
  scoreAllEntities, getRiskBarColor, getRiskColor,
} from '../../utils/riskScoring';

const RISK_LEVELS = ['critical', 'high', 'moderate', 'low', 'minimal'];

const LEVEL_COLORS = {
  critical: { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
  high: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  moderate: { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  low: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  minimal: { bar: 'bg-zinc-500', text: 'text-zinc-400', bg: 'bg-zinc-500/10' },
};

function SectionLabel({ children }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
      {children}
    </h3>
  );
}

function RiskBar({ name, score, maxScore, rank }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const barClass = getRiskBarColor(score);
  const textClass = getRiskColor(score);
  const isTop5 = rank < 5;

  return (
    <div className={clsx(
      'flex items-center gap-3 py-1.5',
      isTop5 && 'bg-white/[0.02] -mx-2 px-2 rounded',
    )}>
      <span className="text-[9px] font-mono text-zinc-600 w-4 tabular-nums shrink-0">
        {rank + 1}.
      </span>
      <span className={clsx(
        'text-[11px] truncate w-28 shrink-0',
        isTop5 ? 'text-zinc-200 font-semibold' : 'text-zinc-400',
      )}>
        {name}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={clsx(
        'text-[10px] font-mono font-bold tabular-nums w-8 text-right shrink-0',
        textClass,
      )}>
        {score}
      </span>
    </div>
  );
}

function DistributionHistogram({ distribution }) {
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {RISK_LEVELS.map((level) => {
        const count = distribution[level] || 0;
        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const colors = LEVEL_COLORS[level];

        return (
          <div key={level} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] font-mono tabular-nums text-zinc-500">
              {count}
            </span>
            <div className="w-full h-10 flex items-end">
              <div
                className={clsx('w-full rounded-t transition-all duration-500', colors.bar)}
                style={{ height: `${height}%`, minHeight: count > 0 ? 2 : 0 }}
              />
            </div>
            <span className={clsx('text-[7px] font-bold tracking-wider', colors.text)}>
              {level.slice(0, 4).toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function RiskOverview() {
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);

  const scored = useMemo(
    () => scoreAllEntities(entities, relationships, events),
    [entities, relationships, events],
  );

  const maxScore = scored.length > 0 ? scored[0].score : 0;

  const distribution = useMemo(() => {
    const counts = { critical: 0, high: 0, moderate: 0, low: 0, minimal: 0 };
    for (const item of scored) {
      counts[item.level] = (counts[item.level] || 0) + 1;
    }
    return counts;
  }, [scored]);

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    : 0;

  const criticalCount = distribution.critical + distribution.high;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold tracking-[0.15em] text-zinc-400 flex items-center gap-2">
          <ShieldAlert size={12} className="text-red-400" />
          RISK ASSESSMENT
        </h3>
        <div className="flex gap-3">
          <div className="text-center">
            <div className="text-[8px] text-zinc-600 tracking-wider">AVG</div>
            <div className={clsx('text-sm font-bold font-mono tabular-nums', getRiskColor(avgScore))}>
              {avgScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-zinc-600 tracking-wider">HIGH+</div>
            <div className={clsx(
              'text-sm font-bold font-mono tabular-nums',
              criticalCount > 0 ? 'text-red-400' : 'text-emerald-400',
            )}>
              {criticalCount}
            </div>
          </div>
        </div>
      </div>

      {/* Distribution histogram */}
      <div className="mb-4">
        <SectionLabel>RISK DISTRIBUTION</SectionLabel>
        <DistributionHistogram distribution={distribution} />
      </div>

      {/* Ranked entity list */}
      <div>
        <SectionLabel>ENTITY RISK RANKING</SectionLabel>
        {scored.length > 0 ? (
          <div className="space-y-0.5">
            {scored.map((item, i) => (
              <RiskBar
                key={item.entity.id}
                name={item.entity.name}
                score={item.score}
                maxScore={maxScore}
                rank={i}
              />
            ))}
          </div>
        ) : (
          <div className="text-zinc-700 text-[10px] text-center py-6">
            NO ENTITIES
          </div>
        )}
      </div>
    </GlassCard>
  );
}
