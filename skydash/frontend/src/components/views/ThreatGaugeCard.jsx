import GlassCard from '../common/GlassCard';

const BANDS = [
  { label: 'LOW', to: 30, color: 'bg-emerald-400' },
  { label: 'MED', to: 60, color: 'bg-amber-400' },
  { label: 'HIGH', to: 85, color: 'bg-red-400' },
  { label: 'CRIT', to: 100, color: 'bg-red-500' },
];

function band(score) {
  return BANDS.find((b) => score < b.to) || BANDS[BANDS.length - 1];
}

const TEXT = {
  LOW: 'text-emerald-400',
  MED: 'text-amber-400',
  HIGH: 'text-red-400',
  CRIT: 'text-red-400',
};

/** Flat threat score: one number, a band label and a segmented bar. */
export default function ThreatGaugeCard({ score, highCount, critCount, total = null }) {
  const clamped = Math.min(Math.max(score, 0), 100);
  const current = band(clamped);
  const empty = total === 0;

  return (
    <GlassCard className="!p-4 h-full" animate={false}>
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
        THREAT SCORE
      </h3>
      {empty ? (
        <p className="text-[11px] text-zinc-500 py-4">No tracked entities yet.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-mono font-semibold tabular-nums ${TEXT[current.label]}`}>
              {clamped}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">/ 100 · {current.label}</span>
          </div>
          <div
            className="relative mt-3 flex gap-[2px] h-1.5"
            role="meter"
            aria-label="Threat score"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clamped}
          >
            {BANDS.map((b, i) => {
              const from = i === 0 ? 0 : BANDS[i - 1].to;
              const fill = Math.min(Math.max((clamped - from) / (b.to - from), 0), 1) * 100;
              return (
                <div key={b.label} className="flex-1 bg-white/[0.06] overflow-hidden">
                  <div className={`h-full ${b.color}`} style={{ width: `${fill}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600">
            {BANDS.map((b) => <span key={b.label}>{b.label}</span>)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono tabular-nums mt-3">
            {highCount} HIGH · {critCount} CRITICAL
          </div>
        </>
      )}
    </GlassCard>
  );
}
