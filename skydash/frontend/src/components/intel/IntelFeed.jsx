import { useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence } from 'framer-motion';
import { Radio, Pause, Play, Trash2 } from 'lucide-react';
import { useFeedStore } from '../../stores/feedStore';
import { useIntelStore } from '../../stores/intelStore';
import FeedItem from './FeedItem';

const FILTERS = ['all', 'critical', 'warning', 'info'];

const FILTER_ACTIVE_STYLES = {
  all: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  info: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
};

function FilterTabs({ active, onChange }) {
  return (
    <div className="flex gap-1">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={clsx(
            'px-2 py-1 rounded text-[9px] font-bold tracking-wider transition-colors',
            active === f
              ? FILTER_ACTIVE_STYLES[f]
              : 'text-zinc-600 hover:text-zinc-400 border border-transparent',
          )}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function LiveIndicator({ isPaused }) {
  if (isPaused) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        <span className="text-[9px] font-bold tracking-wider text-amber-400">PAUSED</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[9px] font-bold tracking-wider text-emerald-400">LIVE</span>
    </div>
  );
}

export default function IntelFeed() {
  const items = useFeedStore((s) => s.items);
  const isPaused = useFeedStore((s) => s.isPaused);
  const filter = useFeedStore((s) => s.filter);
  const setFilter = useFeedStore((s) => s.setFilter);
  const pause = useFeedStore((s) => s.pause);
  const resume = useFeedStore((s) => s.resume);
  const clear = useFeedStore((s) => s.clear);
  const startSimulation = useFeedStore((s) => s.startSimulation);
  const stopSimulation = useFeedStore((s) => s.stopSimulation);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const scrollRef = useRef(null);

  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, [startSimulation, stopSimulation]);

  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [items.length, isPaused]);

  const handleEntityClick = useCallback((entityId) => {
    selectEntity(entityId);
  }, [selectEntity]);

  const filtered = filter === 'all'
    ? items
    : items.filter((i) => i.severity === filter);

  const count = filtered.length;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={10} className="text-cyan-400" />
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            INTEL FEED
          </span>
          <span className="text-[9px] font-mono tabular-nums text-zinc-600">
            ({count})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LiveIndicator isPaused={isPaused} />
          <button
            onClick={() => isPaused ? resume() : pause()}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
            title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          >
            {isPaused ? <Play size={10} /> : <Pause size={10} />}
          </button>
          <button
            onClick={clear}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Clear feed"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterTabs active={filter} onChange={setFilter} />

      {/* Feed items */}
      <div
        ref={scrollRef}
        className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {filtered.map((item) => (
            <FeedItem
              key={item.id}
              item={item}
              onEntityClick={handleEntityClick}
            />
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-[10px] text-zinc-600 text-center py-6">
            {items.length === 0
              ? 'Awaiting intelligence feed...'
              : 'No items match current filter'}
          </div>
        )}
      </div>
    </div>
  );
}
