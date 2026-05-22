import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ShieldAlert } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';
import {
  calculateRiskScore, getRiskLevel, getRiskColor, getRiskStrokeColor,
} from '../../utils/riskScoring';

const GAUGE_RADIUS = 36;
const GAUGE_STROKE = 5;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const ARC_FRACTION = 0.75;
const ARC_LENGTH = GAUGE_CIRCUMFERENCE * ARC_FRACTION;
const ARC_ROTATION = 135;

const LEVEL_BG = {
  minimal: 'bg-zinc-500/10 text-zinc-400',
  low: 'bg-emerald-500/10 text-emerald-400',
  moderate: 'bg-yellow-500/10 text-yellow-400',
  high: 'bg-amber-500/10 text-amber-400',
  critical: 'bg-red-500/10 text-red-400 animate-pulse',
};

const FACTOR_LABELS = {
  baseThreat: 'BASE THREAT',
  relBonus: 'RELATIONSHIPS',
  activityBonus: 'RECENT ACTIVITY',
  confidenceMultiplier: 'CONFIDENCE',
  proximityBonus: 'PROXIMITY',
  escalationBonus: 'ESCALATION',
};

function RiskGauge({ score }) {
  const filled = (score / 100) * ARC_LENGTH;
  const strokeColor = getRiskStrokeColor(score);
  const textColor = getRiskColor(score);

  return (
    <svg width={90} height={78} viewBox="0 0 90 78" className="block">
      <g transform={`rotate(${ARC_ROTATION}, 45, 42)`}>
        <circle
          cx={45} cy={42} r={GAUGE_RADIUS}
          fill="none" stroke="rgba(255,255,255,0.06)"
          strokeWidth={GAUGE_STROKE}
          strokeDasharray={`${ARC_LENGTH} ${GAUGE_CIRCUMFERENCE}`}
          strokeLinecap="round"
        />
        <circle
          cx={45} cy={42} r={GAUGE_RADIUS}
          fill="none" stroke={strokeColor}
          strokeWidth={GAUGE_STROKE}
          strokeDasharray={`${filled} ${GAUGE_CIRCUMFERENCE}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </g>
      <text
        x={45} y={40}
        textAnchor="middle" dominantBaseline="central"
        className={clsx('font-mono font-bold tabular-nums text-[20px]', textColor)}
        fill="currentColor"
      >
        {score}
      </text>
      <text
        x={45} y={56}
        textAnchor="middle"
        className="text-[7px] fill-zinc-600 tracking-[0.15em] font-semibold"
      >
        RISK SCORE
      </text>
    </svg>
  );
}

function MiniSparkline({ data, color }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 16;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="block opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BreakdownTooltip({ breakdown, visible }) {
  if (!visible) return null;

  return (
    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-48 bg-zinc-900/95 border border-white/[0.08] rounded-lg p-2.5 shadow-xl">
      <h5 className="text-[8px] font-bold tracking-[0.15em] text-zinc-500 mb-2">
        FACTOR BREAKDOWN
      </h5>
      <div className="space-y-1.5">
        {Object.entries(breakdown).map(([key, value]) => (
          <div key={key} className="flex justify-between items-baseline">
            <span className="text-[9px] text-zinc-500">{FACTOR_LABELS[key] ?? key}</span>
            <span className="text-[10px] font-mono tabular-nums text-zinc-300">
              {key === 'confidenceMultiplier' ? `x${value.toFixed(2)}` : `+${value}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RiskScoreCard({ entityId, trendHistory = [] }) {
  const entity = useIntelStore((s) => s.entities.find((e) => e.id === entityId));
  const relationships = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);
  const allEntities = useIntelStore((s) => s.entities);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const result = useMemo(() => {
    if (!entity) return null;
    return calculateRiskScore(entity, relationships, events, allEntities);
  }, [entity, relationships, events, allEntities]);

  if (!entity || !result) return null;

  const { score, breakdown } = result;
  const level = getRiskLevel(score);
  const _textColor = getRiskColor(score);
  const strokeHex = getRiskStrokeColor(score);

  const trend = trendHistory.length > 0 ? trendHistory : [score];

  return (
    <div className="border-t border-white/[0.06] pt-3">
      <GlassCard className="!p-3 relative" animate={false}>
        <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
          <ShieldAlert size={10} /> RISK ASSESSMENT
        </h4>

        <div
          className="flex items-center gap-3 cursor-help relative"
          onMouseEnter={() => setShowBreakdown(true)}
          onMouseLeave={() => setShowBreakdown(false)}
        >
          <RiskGauge score={score} />

          <div className="flex-1 space-y-2">
            <div className={clsx(
              'inline-block px-2 py-0.5 rounded text-[9px] font-bold tracking-[0.12em]',
              LEVEL_BG[level],
            )}>
              {level.toUpperCase()}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-zinc-600 tracking-wider">TREND</span>
              <MiniSparkline data={trend} color={strokeHex} />
            </div>

            <div className="text-[9px] text-zinc-600 font-mono">
              CONF {entity.confidence}% &middot; {relationships.filter(
                (r) => r.from === entityId || r.to === entityId
              ).length} REL
            </div>
          </div>

          <BreakdownTooltip breakdown={breakdown} visible={showBreakdown} />
        </div>
      </GlassCard>
    </div>
  );
}
