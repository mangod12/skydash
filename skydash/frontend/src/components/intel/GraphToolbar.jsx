import { GitBranch, Maximize2, Network, Grid3x3, CircleDot, Layers } from 'lucide-react';
import { clsx } from 'clsx';

const LAYOUT_OPTIONS = [
  { id: 'force', label: 'FORCE', icon: GitBranch },
  { id: 'radial', label: 'RADIAL', icon: CircleDot },
  { id: 'grid', label: 'GRID', icon: Grid3x3 },
];

export default function GraphToolbar({
  layout, onLayoutChange, onZoomFit, onExpandAll,
  expanded, communities, onToggleCommunities, focusedId, onClearFocus, focusName,
}) {
  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
      {/* Layout toggle */}
      <div className="bg-zinc-900/80 backdrop-blur border border-white/10 rounded-lg p-1.5 flex gap-1">
        {LAYOUT_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onLayoutChange(id)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-semibold tracking-wider transition-colors',
              layout === id
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
            title={label}
          >
            <Icon size={10} />
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="bg-zinc-900/80 backdrop-blur border border-white/10 rounded-lg p-1.5 flex gap-1">
        <button
          onClick={onZoomFit}
          className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-semibold tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Zoom to fit"
        >
          <Maximize2 size={10} /> FIT
        </button>
        <button
          onClick={onExpandAll}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-semibold tracking-wider transition-colors',
            expanded ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300',
          )}
          title={expanded ? 'Collapse' : 'Expand all'}
        >
          <Network size={10} /> {expanded ? 'COLLAPSE' : 'EXPAND'}
        </button>
        <button
          onClick={onToggleCommunities}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-[8px] font-semibold tracking-wider transition-colors',
            communities ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300',
          )}
          title="Toggle community detection"
        >
          <Layers size={10} /> COMM
        </button>
      </div>

      {/* Focus indicator */}
      {focusedId && (
        <button
          onClick={onClearFocus}
          className="bg-zinc-900/80 backdrop-blur border border-indigo-500/30 rounded-lg px-2 py-1.5 text-[9px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors text-left"
        >
          FOCUSED: {focusName} <span className="text-zinc-600 ml-1">ESC</span>
        </button>
      )}
    </div>
  );
}
