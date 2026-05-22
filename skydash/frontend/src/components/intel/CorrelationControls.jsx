import { clsx } from 'clsx';
import { ZoomIn, ZoomOut, Check } from 'lucide-react';
import { SEVERITY_COLORS } from './CorrelationLane';

const MAX_ENTITIES = 8;
const RANGE_OPTIONS = ['1h', '6h', '24h', '7d', 'all'];

export function CorrelationHeader({
  range,
  setRange,
  zoom,
  onZoom,
  entities,
  selectedIds,
  toggleEntity,
  selectorOpen,
  setSelectorOpen,
  correlationCount,
}) {
  return (
    <div className="p-3 border-b border-white/[0.06] shrink-0 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-bold tracking-[0.15em] text-zinc-500">
            TIMELINE CORRELATION
          </h3>
          <span className="text-[9px] font-mono text-violet-400">
            {correlationCount} correlations found
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onZoom(-1)}
            className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[9px] font-mono text-zinc-600 w-8 text-center">
            {zoom.toFixed(1)}x
          </span>
          <button
            onClick={() => onZoom(1)}
            className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Time range selector */}
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'px-2 py-0.5 rounded text-[9px] font-mono tracking-wider transition-colors',
                range === r
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-zinc-600 hover:text-zinc-400',
              )}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Entity selector toggle */}
        <div className="relative">
          <button
            onClick={() => setSelectorOpen((p) => !p)}
            className={clsx(
              'px-2 py-0.5 rounded text-[9px] tracking-wider transition-colors',
              selectorOpen
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-zinc-600 hover:text-zinc-400',
            )}
          >
            ENTITIES ({selectedIds.size}/{MAX_ENTITIES})
          </button>
          {selectorOpen && (
            <EntityDropdown
              entities={entities}
              selectedIds={selectedIds}
              toggleEntity={toggleEntity}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EntityDropdown({ entities, selectedIds, toggleEntity }) {
  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-52 max-h-48 overflow-y-auto rounded-lg border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-xl p-1.5">
      {entities.map((e) => (
        <button
          key={e.id}
          onClick={() => toggleEntity(e.id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-white/5 transition-colors"
        >
          <div
            className={clsx(
              'w-3.5 h-3.5 rounded border flex items-center justify-center',
              selectedIds.has(e.id)
                ? 'bg-indigo-500 border-indigo-400'
                : 'border-zinc-600',
            )}
          >
            {selectedIds.has(e.id) && <Check size={8} className="text-white" />}
          </div>
          <span className="text-[10px] text-zinc-300 truncate">{e.name}</span>
          <span className="text-[8px] text-zinc-600 ml-auto">{e.type}</span>
        </button>
      ))}
    </div>
  );
}

export function EventTooltip({ tooltip }) {
  const { fill } = SEVERITY_COLORS[tooltip.event.severity] ?? SEVERITY_COLORS.info;
  const time = new Date(tooltip.event.time).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="rounded-lg border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-xl p-2.5 max-w-[220px]">
        <div className="flex items-center gap-1.5 mb-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: fill }}
          />
          <span className="text-[9px] font-bold tracking-wider text-zinc-400">
            {tooltip.event.severity.toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">
            {time}
          </span>
        </div>
        <p className="text-[10px] text-zinc-300 leading-snug">
          {tooltip.event.description}
        </p>
        <p className="text-[9px] text-cyan-400/70 mt-1 font-mono">
          {tooltip.entity.name}
        </p>
      </div>
    </div>
  );
}

export { MAX_ENTITIES, RANGE_OPTIONS };
