import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { ArrowUpDown } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import {
  CATEGORY_STYLES, SORT_OPTIONS, THREAT_ORDER, MAX_ENTITIES,
  categorizeRelationship,
} from './matrixConstants';
import { ColumnHeaders, RowHeader, MatrixCell, Tooltip } from './MatrixCells';

export default function ConnectionMatrix() {
  const allEntities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const setComparedEntity = useIntelStore((s) => s.setComparedEntity);
  const [sortBy, setSortBy] = useState('connections');
  const [tooltip, setTooltip] = useState(null);

  const { entities, matrix, maxCount, connectionCounts } = useMemo(() => {
    const connCounts = {};
    allEntities.forEach((e) => { connCounts[e.id] = 0; });
    relationships.forEach((r) => {
      connCounts[r.from] = (connCounts[r.from] || 0) + 1;
      connCounts[r.to] = (connCounts[r.to] || 0) + 1;
    });

    let sorted = [...allEntities];
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'type') sorted.sort((a, b) => a.type.localeCompare(b.type));
    else if (sortBy === 'threat') sorted.sort((a, b) => (THREAT_ORDER[b.threatLevel] || 0) - (THREAT_ORDER[a.threatLevel] || 0));
    else sorted.sort((a, b) => (connCounts[b.id] || 0) - (connCounts[a.id] || 0));

    const top = sorted.slice(0, MAX_ENTITIES);
    const idSet = new Set(top.map((e) => e.id));
    const idxMap = {};
    top.forEach((e, i) => { idxMap[e.id] = i; });

    const n = top.length;
    const grid = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ count: 0, rels: [] })),
    );

    let max = 0;
    relationships.forEach((r) => {
      if (!idSet.has(r.from) || !idSet.has(r.to)) return;
      const ri = idxMap[r.from];
      const ci = idxMap[r.to];
      grid[ri][ci].count += 1;
      grid[ri][ci].rels.push(r);
      grid[ci][ri].count += 1;
      grid[ci][ri].rels.push(r);
      max = Math.max(max, grid[ri][ci].count, grid[ci][ri].count);
    });

    return { entities: top, matrix: grid, maxCount: max, connectionCounts: connCounts };
  }, [allEntities, relationships, sortBy]);

  const handleCellClick = useCallback((rowEntity, colEntity) => {
    if (rowEntity.id === colEntity.id) {
      selectEntity(rowEntity.id);
      return;
    }
    setComparedEntity(0, rowEntity.id);
    setComparedEntity(1, colEntity.id);
  }, [selectEntity, setComparedEntity]);

  const handleCellHover = useCallback((e, rowIdx, colIdx) => {
    if (rowIdx === colIdx) { setTooltip(null); return; }
    const cell = matrix[rowIdx][colIdx];
    if (cell.count === 0) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      rowName: entities[rowIdx].name,
      colName: entities[colIdx].name,
      count: cell.count,
      types: [...new Set(cell.rels.map((r) => r.type))],
      category: cell.rels.length > 0 ? categorizeRelationship(cell.rels[0]) : 'data',
    });
  }, [matrix, entities]);

  const n = entities.length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <MatrixHeader sortBy={sortBy} setSortBy={setSortBy} count={n} />
      <Legend />
      <div className="flex-1 min-h-0 overflow-auto mt-3">
        <div className="inline-block min-w-fit">
          <ColumnHeaders entities={entities} />
          {entities.map((rowEntity, ri) => (
            <div key={rowEntity.id} className="flex items-center">
              <RowHeader entity={rowEntity} connections={connectionCounts[rowEntity.id] || 0} />
              {entities.map((colEntity, ci) => (
                <MatrixCell
                  key={colEntity.id}
                  isDiag={ri === ci}
                  entity={ri === ci ? rowEntity : null}
                  cell={matrix[ri][ci]}
                  maxCount={maxCount}
                  onClick={() => handleCellClick(rowEntity, colEntity)}
                  onMouseEnter={(e) => handleCellHover(e, ri, ci)}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {tooltip && <Tooltip {...tooltip} />}
    </div>
  );
}

function MatrixHeader({ sortBy, setSortBy, count }) {
  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          CONNECTION MATRIX
        </h2>
        <span className="text-[9px] font-mono tabular-nums text-zinc-600">
          {count}x{count}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ArrowUpDown size={10} className="text-zinc-600" />
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSortBy(opt.id)}
            className={clsx(
              'px-2 py-0.5 rounded text-[8px] font-semibold tracking-[0.1em] transition-colors',
              sortBy === opt.id
                ? 'bg-indigo-500/15 text-indigo-400'
                : 'text-zinc-600 hover:text-zinc-400',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 mt-2 shrink-0">
      {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className={clsx('w-2.5 h-2.5 rounded-sm', style.bg, 'opacity-60')} />
          <span className={clsx('text-[8px] font-semibold tracking-[0.1em]', style.text)}>
            {style.label}
          </span>
        </div>
      ))}
    </div>
  );
}
