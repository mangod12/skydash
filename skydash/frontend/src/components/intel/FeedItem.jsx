import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { format } from 'date-fns';

const SEVERITY_DOT = {
  critical: 'bg-red-500 shadow-red-500/50 shadow-sm animate-pulse',
  warning: 'bg-amber-500 shadow-amber-500/40 shadow-sm',
  info: 'bg-cyan-500',
};

const CATEGORY_BADGE = {
  SIGINT: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  HUMINT: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  GEOINT: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  OSINT: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  CYBER: 'text-red-400 border-red-500/30 bg-red-500/10',
};

export default function FeedItem({ item, onEntityClick }) {
  const hasEntity = Boolean(item.entityId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div
        className={clsx(
          'p-2.5 rounded-lg border backdrop-blur-sm transition-colors',
          'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]',
          hasEntity && 'cursor-pointer',
        )}
        onClick={() => hasEntity && onEntityClick(item.entityId)}
        role={hasEntity ? 'button' : undefined}
        tabIndex={hasEntity ? 0 : undefined}
      >
        <div className="flex items-start gap-2">
          {/* Severity dot */}
          <div className={clsx('w-2 h-2 rounded-full shrink-0 mt-1.5', SEVERITY_DOT[item.severity])} />

          <div className="flex-1 min-w-0">
            {/* Top row: time + category */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-mono tabular-nums text-zinc-600 shrink-0">
                {format(item.timestamp, 'HH:mm:ss')}
              </span>
              <span className={clsx(
                'text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                CATEGORY_BADGE[item.category],
              )}>
                {item.category}
              </span>
              {item.location && (
                <span className="text-[8px] text-zinc-600 flex items-center gap-0.5 truncate">
                  <MapPin size={8} className="shrink-0" />
                  {item.location}
                </span>
              )}
            </div>

            {/* Title */}
            <div className="text-[11px] font-semibold text-zinc-200 leading-tight">
              {item.title}
            </div>

            {/* Summary */}
            <div className="text-[10px] text-zinc-500 leading-snug mt-0.5 line-clamp-1">
              {item.summary}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
