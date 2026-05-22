import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { useIntelStore } from '../../stores/intelStore';

const SEVERITY_CONFIG = {
  info: { dot: 'bg-blue-500', line: 'border-blue-500/20', text: 'text-blue-400' },
  warning: { dot: 'bg-amber-500', line: 'border-amber-500/20', text: 'text-amber-400' },
  critical: { dot: 'bg-red-500 animate-pulse', line: 'border-red-500/20', text: 'text-red-400' },
};

export default function TimelineView() {
  const events = useIntelStore((s) => s.events);
  const entities = useIntelStore((s) => s.entities);
  const selectEntity = useIntelStore((s) => s.selectEntity);

  const sorted = [...events].sort((a, b) => b.time - a.time);

  const getEntityName = (id) => entities.find((e) => e.id === id)?.name ?? 'Unknown';

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-white/[0.06] shrink-0">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          EVENT TIMELINE
        </h3>
        <div className="text-[9px] text-zinc-600 mt-0.5">{events.length} events recorded</div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/[0.06]" />

          <div className="space-y-1">
            {sorted.map((event, i) => {
              const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative pl-6 py-2"
                >
                  {/* Dot */}
                  <div className={clsx(
                    'absolute left-[4px] top-3 w-[7px] h-[7px] rounded-full z-10',
                    config.dot,
                  )} />

                  {/* Content */}
                  <div
                    className={clsx(
                      'p-2.5 rounded-lg border cursor-pointer transition-colors',
                      'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]',
                    )}
                    onClick={() => event.entityId && selectEntity(event.entityId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[11px] text-zinc-300 leading-snug">
                        {event.description}
                      </div>
                      <span className={clsx(
                        'text-[8px] font-bold tracking-wider shrink-0 px-1.5 py-0.5 rounded',
                        config.text,
                        event.severity === 'critical' ? 'bg-red-500/10' : 'bg-transparent',
                      )}>
                        {event.severity.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-600">
                      <span className="font-mono tabular-nums">
                        {formatDistanceToNow(event.time, { addSuffix: true })}
                      </span>
                      {event.entityId && (
                        <>
                          <span>&middot;</span>
                          <span className="text-zinc-500">{getEntityName(event.entityId)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
