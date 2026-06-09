import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const TIERS = [
  { max: 5000, label: 'LIVE', color: 'emerald', dot: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.5)]', pulse: true },
  { max: 60000, label: 'RECENT', color: 'cyan', dot: 'bg-cyan-500', text: 'text-cyan-400', glow: 'shadow-[0_0_6px_rgba(34,211,238,0.4)]', pulse: false },
  { max: 600000, label: 'STALE', color: 'amber', dot: 'bg-amber-500', text: 'text-amber-400', glow: '', pulse: false },
  { max: Infinity, label: 'OFFLINE', color: 'red', dot: 'bg-red-500', text: 'text-red-400', glow: '', pulse: false },
];

function getTier(ageMs) {
  return TIERS.find((t) => ageMs < t.max) || TIERS[TIERS.length - 1];
}

function formatRelative(ageMs) {
  if (ageMs < 5000) return 'just now';
  if (ageMs < 60000) return `${Math.floor(ageMs / 1000)}s ago`;
  if (ageMs < 3600000) return `${Math.floor(ageMs / 60000)}m ago`;
  return `${Math.floor(ageMs / 3600000)}h ago`;
}

export default function FreshnessIndicator({
  timestamp,
  source,
  compact = false,
  className,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ts = useMemo(() => {
    if (!timestamp) return null;
    return timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
  }, [timestamp]);

  if (!ts) {
    return (
      <span className={clsx('inline-flex items-center gap-1.5', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
        <span className="text-[9px] font-semibold tracking-wider text-zinc-600">
          NO DATA
        </span>
      </span>
    );
  }

  const ageMs = Math.max(0, now - ts);
  const tier = getTier(ageMs);
  const exactTime = format(new Date(ts), 'yyyy-MM-dd HH:mm:ss');
  const tooltip = source ? `${source} - ${exactTime}` : exactTime;

  return (
    <span
      className={clsx('inline-flex items-center gap-1.5', className)}
      title={tooltip}
    >
      {/* Status dot */}
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full shrink-0',
          tier.dot,
          tier.glow,
          tier.pulse && 'animate-pulse',
        )}
      />

      {/* Label */}
      <span className={clsx('text-[9px] font-semibold tracking-wider', tier.text)}>
        {tier.label}
      </span>

      {/* Source name (expanded only) */}
      {!compact && source && (
        <span className="text-[9px] text-zinc-600 font-mono truncate max-w-[80px]">
          {source}
        </span>
      )}

      {/* Relative time (expanded only) */}
      {!compact && (
        <span className="text-[9px] font-mono tabular-nums text-zinc-600">
          {formatRelative(ageMs)}
        </span>
      )}
    </span>
  );
}
