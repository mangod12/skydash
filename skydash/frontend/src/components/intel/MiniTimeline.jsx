import { clsx } from 'clsx';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

const SEVERITY_DOT_COLORS = {
  info: 'bg-cyan-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-500',
};

export default function MiniTimeline({ events, totalCount, onViewAll }) {
  if (events.length === 0) return null;

  return (
    <div className="border-t border-white/[0.06] pt-3">
      <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
        <Clock size={10} /> RECENT ACTIVITY
      </h4>
      <div className="space-y-1.5">
        {events.map((evt) => (
          <div key={evt.id} className="flex items-start gap-2">
            <div className="flex flex-col items-center pt-1.5">
              <div className={clsx(
                'w-2 h-2 rounded-full shrink-0',
                SEVERITY_DOT_COLORS[evt.severity] || 'bg-zinc-500'
              )} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-mono tabular-nums text-zinc-500">
                {format(evt.time, 'HH:mm')}Z
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                {evt.description}
              </div>
            </div>
          </div>
        ))}
      </div>
      {totalCount > 5 && (
        <button
          onClick={onViewAll}
          className="mt-2 text-[9px] font-semibold tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          VIEW ALL ({totalCount})
        </button>
      )}
    </div>
  );
}
