import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import {
  TYPE_ICONS, TYPE_COLORS, CATEGORY_STYLES,
  categorizeRelationship, getCellOpacity, getCssColor,
} from './matrixConstants';

export function ColumnHeaders({ entities }) {
  return (
    <div className="flex items-end" style={{ marginLeft: '120px' }}>
      {entities.map((entity) => {
        const Icon = TYPE_ICONS[entity.type] || AlertTriangle;
        const color = TYPE_COLORS[entity.type] || 'text-zinc-400';
        return (
          <div
            key={entity.id}
            className="w-8 h-[72px] flex items-end justify-center pb-1"
          >
            <div
              className="origin-bottom-left whitespace-nowrap flex items-center gap-1"
              style={{ transform: 'rotate(-45deg)', transformOrigin: 'bottom left', width: '60px' }}
            >
              <Icon size={8} className={color} />
              <span className="text-[7px] font-semibold tracking-wider text-zinc-500 truncate">
                {entity.name.length > 8 ? entity.name.slice(0, 8) + '..' : entity.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RowHeader({ entity, connections }) {
  const Icon = TYPE_ICONS[entity.type] || AlertTriangle;
  const color = TYPE_COLORS[entity.type] || 'text-zinc-400';
  return (
    <div className="w-[120px] shrink-0 flex items-center gap-1.5 pr-2 py-0.5">
      <Icon size={10} className={color} />
      <span className="text-[8px] font-semibold text-zinc-400 truncate flex-1" title={entity.name}>
        {entity.name.length > 12 ? entity.name.slice(0, 12) + '..' : entity.name}
      </span>
      <span className="text-[7px] font-mono tabular-nums text-zinc-600">{connections}</span>
    </div>
  );
}

export function MatrixCell({ isDiag, entity, cell, maxCount, onClick, onMouseEnter, onMouseLeave }) {
  if (isDiag) {
    const Icon = entity ? (TYPE_ICONS[entity.type] || AlertTriangle) : null;
    const color = entity ? (TYPE_COLORS[entity.type] || 'text-zinc-500') : 'text-zinc-500';
    return (
      <div className="w-8 h-8 flex items-center justify-center border border-white/[0.04] bg-white/[0.02]">
        {Icon && <Icon size={10} className={color} />}
      </div>
    );
  }

  const { count, rels } = cell;
  const category = count > 0 ? categorizeRelationship(rels[0]) : null;
  const style = category ? CATEGORY_STYLES[category] : null;
  const opacity = getCellOpacity(count, maxCount);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        'w-8 h-8 border border-white/[0.04] transition-all duration-150',
        count > 0
          ? 'hover:border-white/20 hover:scale-110 hover:z-10 cursor-pointer'
          : 'cursor-default',
      )}
      style={
        count > 0 && style
          ? { backgroundColor: `color-mix(in srgb, ${getCssColor(category)} ${Math.round(opacity * 100)}%, transparent)` }
          : undefined
      }
    >
      {count > 0 && (
        <span className={clsx('text-[8px] font-mono font-bold tabular-nums', style?.text)}>
          {count}
        </span>
      )}
    </button>
  );
}

export function Tooltip({ x, y, rowName, colName, count, types, category }) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.data;
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
    >
      <div className="rounded-lg border border-white/[0.1] bg-zinc-900/95 backdrop-blur-xl px-3 py-2 shadow-xl">
        <div className="flex items-center gap-1.5 mb-1">
          <div className={clsx('w-1.5 h-1.5 rounded-full', style.bg)} />
          <span className={clsx('text-[8px] font-semibold tracking-wider', style.text)}>
            {style.label}
          </span>
        </div>
        <p className="text-[9px] text-zinc-300 font-semibold">{rowName}</p>
        <p className="text-[8px] text-zinc-600 my-0.5">&#x2194; {colName}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] font-mono tabular-nums text-zinc-400">
            {count} link{count !== 1 ? 's' : ''}
          </span>
          <span className="text-[7px] text-zinc-600 tracking-wider">
            {types.join(', ').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
