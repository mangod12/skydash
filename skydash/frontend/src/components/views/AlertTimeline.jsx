import { useMemo, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import GlassCard from '../common/GlassCard';

const SEVERITY_COLORS = {
  critical: { dot: 'bg-red-500', text: 'text-red-300', border: 'border-red-500/30' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-500/20' },
  info: { dot: 'bg-indigo-500', text: 'text-zinc-400', border: 'border-indigo-500/20' },
};

export default function AlertTimeline({ events }) {
  const scrollRef = useRef(null);

  const sorted = useMemo(
    () => [...events].sort((a, b) => b.time - a.time).slice(0, 20),
    [events],
  );

  // Auto-scroll to start on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [sorted.length]);

  if (sorted.length === 0) return null;

  return (
    <GlassCard className="!p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          ALERT TIMELINE
        </h3>
        <span className="text-[9px] text-zinc-600 font-mono tabular-nums">
          {sorted.length} EVENTS
        </span>
      </div>
      {/* Horizontal scrolling timeline */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {sorted.map((evt) => {
          const sev = SEVERITY_COLORS[evt.severity] || SEVERITY_COLORS.info;
          return (
            <div
              key={evt.id}
              className={`shrink-0 w-48 rounded-lg border ${sev.border} bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${sev.dot} shrink-0`} />
                <span className="text-[8px] font-mono text-zinc-600 tabular-nums">
                  {formatDistanceToNow(evt.time, { addSuffix: true })}
                </span>
              </div>
              <p className={`text-[10px] leading-tight ${sev.text} line-clamp-2`}>
                {evt.description}
              </p>
              {evt.entityId && (
                <span className="text-[8px] text-zinc-600 font-mono mt-1 block">
                  {evt.entityId}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
