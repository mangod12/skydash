import { clsx } from 'clsx';

const TIERS = [
  { min: 80, label: 'VERIFIED', bg: 'bg-emerald-500', text: 'text-emerald-400', track: 'bg-emerald-500/20' },
  { min: 60, label: 'RELIABLE', bg: 'bg-cyan-500', text: 'text-cyan-400', track: 'bg-cyan-500/20' },
  { min: 40, label: 'MODERATE', bg: 'bg-amber-500', text: 'text-amber-400', track: 'bg-amber-500/20' },
  { min: 20, label: 'UNCERTAIN', bg: 'bg-orange-500', text: 'text-orange-400', track: 'bg-orange-500/20' },
  { min: 0, label: 'UNVERIFIED', bg: 'bg-red-500', text: 'text-red-400', track: 'bg-red-500/20' },
];

function getTier(score) {
  return TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1];
}

export default function SourceReliability({ score = 0, label, className }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tier = getTier(clamped);

  return (
    <div className={clsx('space-y-1', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            {label}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className={clsx('text-[9px] font-bold tracking-widest', tier.text)}>
            {tier.label}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-zinc-300">
            {clamped}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className={clsx('h-1.5 rounded-full overflow-hidden', tier.track)}>
        <div
          className={clsx('h-full rounded-full transition-all duration-500', tier.bg)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
