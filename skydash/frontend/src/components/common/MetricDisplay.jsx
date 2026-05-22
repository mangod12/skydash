import { clsx } from 'clsx';

export default function MetricDisplay({
  label,
  value,
  unit,
  color = 'text-cyan-400',
  size = 'md',
  mono = true,
}) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  };

  return (
    <div className="space-y-1">
      <div className="text-zinc-500 text-[10px] font-semibold tracking-[0.15em] uppercase">
        {label}
      </div>
      <div className={clsx(
        sizes[size],
        'font-bold leading-none',
        mono && 'font-mono tabular-nums',
        color,
      )}>
        {value ?? '--'}
        {unit && (
          <span className="text-zinc-500 text-sm ml-1 font-sans font-normal">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
