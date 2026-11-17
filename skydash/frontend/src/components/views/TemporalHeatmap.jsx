import { useMemo } from 'react';
import { buildGrid } from '../../utils/eventBuckets';
import GlassCard from '../common/GlassCard';

const ROW_LABELS = ['CRITICAL', 'WARNING', 'INFO', 'DETECT'];

const CELL_COLORS = [
  'bg-zinc-800/40',
  'bg-cyan-900/30',
  'bg-cyan-700/40',
  'bg-amber-700/40',
  'bg-red-700/40',
  'bg-red-500/50',
];

function intensityClass(count) {
  if (count === 0) return CELL_COLORS[0];
  if (count === 1) return CELL_COLORS[1];
  if (count === 2) return CELL_COLORS[2];
  if (count <= 4) return CELL_COLORS[3];
  if (count <= 6) return CELL_COLORS[4];
  return CELL_COLORS[5];
}

export default function TemporalHeatmap({ events }) {
  const { grid, colLabels } = useMemo(() => buildGrid(events), [events]);

  return (
    <GlassCard>
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
        ACTIVITY HEATMAP
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Column headers */}
          <div className="flex ml-[60px] mb-1">
            {colLabels.map((label, i) => (
              <div key={i} className="flex-1 text-center text-[7px] font-mono text-zinc-600 tabular-nums">
                {i % 2 === 0 ? label : ''}
              </div>
            ))}
          </div>
          {/* Grid rows */}
          {grid.map((row, ri) => (
            <div key={ri} className="flex items-center gap-1 mb-0.5">
              <span className="text-[8px] font-mono text-zinc-600 w-[56px] text-right tracking-wider shrink-0">
                {ROW_LABELS[ri]}
              </span>
              <div className="flex flex-1 gap-0.5">
                {row.map((count, ci) => (
                  <div
                    key={ci}
                    className={`flex-1 h-5 rounded-sm ${intensityClass(count)} border border-white/[0.03] transition-colors`}
                    title={`${ROW_LABELS[ri]} @ ${colLabels[ci]}: ${count} events`}
                  />
                ))}
              </div>
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2">
            <span className="text-[8px] text-zinc-600 mr-1">LESS</span>
            {CELL_COLORS.map((cls, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${cls} border border-white/[0.04]`} />
            ))}
            <span className="text-[8px] text-zinc-600 ml-1">MORE</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
