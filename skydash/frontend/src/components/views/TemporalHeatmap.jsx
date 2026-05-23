import { useMemo } from 'react';
import GlassCard from '../common/GlassCard';

const ROWS = 4;
const COLS = 12;
const ROW_LABELS = ['CRITICAL', 'WARNING', 'INFO', 'DETECT'];
const SEVERITY_TO_ROW = { critical: 0, warning: 1, info: 2, detection: 3 };

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

function buildGrid(events) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  if (events.length === 0) return { grid, colLabels: [] };

  const now = Date.now();
  const oldest = Math.min(...events.map((e) => e.time));
  const span = Math.max(now - oldest, 60000);
  const step = span / COLS;

  const colLabels = Array.from({ length: COLS }, (_, i) => {
    const d = new Date(oldest + i * step);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  events.forEach((evt) => {
    const col = Math.min(Math.floor((evt.time - oldest) / step), COLS - 1);
    const row = SEVERITY_TO_ROW[evt.severity] ?? SEVERITY_TO_ROW[evt.type] ?? 3;
    grid[row][col]++;
  });

  return { grid, colLabels };
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
