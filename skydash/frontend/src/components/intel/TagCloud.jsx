import { useMemo } from 'react';
import { clsx } from 'clsx';
import { useIntelStore } from '../../stores/intelStore';

export default function TagCloud({ onTagClick }) {
  const entities = useIntelStore((s) => s.entities);

  const tags = useMemo(() => {
    const counts = {};
    entities.forEach((e) => (e.tags ?? []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    const sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const max = sorted[0]?.count ?? 1;
    return sorted.map((t) => ({ ...t, ratio: t.count / max }));
  }, [entities]);

  if (tags.length === 0) return null;

  return (
    <div>
      <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-2">
        TAG CLOUD
      </span>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const size = tag.ratio > 0.6 ? 'text-[11px]' : tag.ratio > 0.3 ? 'text-[10px]' : 'text-[9px]';
          const color = tag.ratio > 0.6
            ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
            : tag.ratio > 0.3
              ? 'text-zinc-400 border-zinc-500/20 bg-white/[0.04]'
              : 'text-zinc-600 border-white/[0.06] bg-white/[0.02]';
          return (
            <button
              key={tag.name}
              onClick={() => onTagClick?.(tag.name)}
              className={clsx(
                'rounded-full px-2 py-0.5 font-mono tabular-nums border transition-all duration-150',
                'hover:scale-105 hover:brightness-125 cursor-pointer',
                size, color,
              )}
              style={{ opacity: 0.5 + tag.ratio * 0.5 }}
            >
              {tag.name}({tag.count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
