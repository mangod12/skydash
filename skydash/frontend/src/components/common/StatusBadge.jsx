import { clsx } from 'clsx';

const COLORS = {
  connected: { dot: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' },
  disconnected: { dot: 'bg-red-500', text: 'text-red-400', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.5)]' },
  armed: { dot: 'bg-cyan-500', text: 'text-cyan-400', glow: 'shadow-[0_0_8px_rgba(34,211,238,0.5)]' },
  idle: { dot: 'bg-zinc-500', text: 'text-zinc-400', glow: '' },
};

export default function StatusBadge({ status = 'idle', label, pulse = false }) {
  const colors = COLORS[status] || COLORS.idle;

  return (
    <div className="flex items-center gap-2">
      <div className={clsx(
        'w-2 h-2 rounded-full',
        colors.dot,
        colors.glow,
        pulse && 'animate-pulse',
      )} />
      <span className={clsx('text-xs font-semibold tracking-wider uppercase', colors.text)}>
        {label}
      </span>
    </div>
  );
}
