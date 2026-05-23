import { motion } from 'framer-motion';
import GlassCard from '../common/GlassCard';

const SIZE = 120;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = Math.PI * RADIUS;
const START_ANGLE = Math.PI;

function polarToCartesian(cx, cy, r, angle) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

const SEGMENTS = [
  { label: 'LOW', color: '#10b981', from: 0, to: 0.3 },
  { label: 'MED', color: '#f59e0b', from: 0.3, to: 0.6 },
  { label: 'HIGH', color: '#ef4444', from: 0.6, to: 0.85 },
  { label: 'CRIT', color: '#dc2626', from: 0.85, to: 1.0 },
];

function scoreColor(score) {
  if (score >= 85) return '#dc2626';
  if (score >= 60) return '#ef4444';
  if (score >= 30) return '#f59e0b';
  return '#10b981';
}

export default function ThreatGaugeCard({ score, highCount, critCount }) {
  const cx = SIZE / 2;
  const cy = SIZE / 2 + 8;
  const normalizedScore = Math.min(Math.max(score, 0), 100) / 100;
  const needleAngle = START_ANGLE + normalizedScore * Math.PI;

  return (
    <GlassCard className="!p-4">
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
        THREAT GAUGE
      </h3>
      <div className="flex items-center justify-center">
        <svg width={SIZE} height={SIZE * 0.65} viewBox={`0 0 ${SIZE} ${SIZE * 0.65}`}>
          {/* Background segments */}
          {SEGMENTS.map((seg) => (
            <path
              key={seg.label}
              d={arcPath(cx, cy, RADIUS, START_ANGLE + seg.from * Math.PI, START_ANGLE + seg.to * Math.PI)}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              opacity={0.2}
            />
          ))}
          {/* Active arc */}
          <motion.path
            d={arcPath(cx, cy, RADIUS, START_ANGLE, START_ANGLE + normalizedScore * Math.PI)}
            fill="none"
            stroke={scoreColor(score)}
            strokeWidth={STROKE}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Needle */}
          <motion.line
            x1={cx}
            y1={cy}
            x2={cx + (RADIUS - 16) * Math.cos(needleAngle)}
            y2={cy + (RADIUS - 16) * Math.sin(needleAngle)}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.8 }}
          />
          {/* Center dot */}
          <circle cx={cx} cy={cy} r={3} fill="white" opacity={0.6} />
        </svg>
      </div>
      <div className="text-center -mt-1">
        <div className="text-2xl font-mono font-bold tabular-nums" style={{ color: scoreColor(score) }}>
          {score}
        </div>
        <div className="text-[9px] text-zinc-500 font-mono tabular-nums mt-0.5">
          {highCount} HIGH · {critCount} CRITICAL
        </div>
      </div>
    </GlassCard>
  );
}
