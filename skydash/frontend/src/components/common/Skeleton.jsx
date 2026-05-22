import { clsx } from 'clsx';

export function SkeletonLine({ width = '100%', height = 12, className }) {
  return (
    <div
      className={clsx('rounded bg-zinc-800/60 animate-shimmer', className)}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ children, className }) {
  return (
    <div className={clsx(
      'rounded-2xl border border-white/[0.04] bg-zinc-900/30 p-5 space-y-3',
      className
    )}>
      {children || (
        <>
          <SkeletonLine width="40%" height={10} />
          <SkeletonLine width="70%" height={24} />
          <SkeletonLine width="55%" height={10} />
        </>
      )}
    </div>
  );
}

export function SkeletonChart({ className }) {
  return (
    <div className={clsx('rounded-2xl border border-white/[0.04] bg-zinc-900/30 p-5', className)}>
      <SkeletonLine width="30%" height={10} className="mb-4" />
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-zinc-800/40 rounded-t animate-shimmer"
            style={{
              height: `${20 + Math.sin(i * 0.5) * 40 + 40}%`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
