import { useState } from 'react';
import { clsx } from 'clsx';
import { Search, Filter } from 'lucide-react';
import EntityCard from './EntityCard';
import ThreatMatrix from './ThreatMatrix';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';

const TYPE_FILTERS = [
  { id: null, label: 'ALL' },
  { id: 'person', label: 'PERSON' },
  { id: 'vehicle', label: 'VEHICLE' },
  { id: 'building', label: 'BUILDING' },
  { id: 'device', label: 'DEVICE' },
  { id: 'event', label: 'EVENT' },
];

export default function IntelPanel() {
  const { entities, selectedEntityId, selectEntity, filterType, setFilterType } = useIntelStore();
  const [search, setSearch] = useState('');

  const filtered = entities.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Sort: critical/high first, then by lastSeen
  const sorted = [...filtered].sort((a, b) => {
    const threatOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    const diff = (threatOrder[a.threatLevel] ?? 5) - (threatOrder[b.threatLevel] ?? 5);
    if (diff !== 0) return diff;
    return b.lastSeen - a.lastSeen;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            INTELLIGENCE
          </h3>
          <span className="text-[9px] font-mono tabular-nums text-zinc-600">
            {filtered.length}/{entities.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/30 transition-colors"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id ?? 'all'}
              onClick={() => setFilterType(f.id)}
              className={clsx(
                'px-2 py-0.5 rounded text-[8px] font-semibold tracking-wider transition-colors',
                filterType === f.id
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-zinc-600 hover:text-zinc-400 border border-transparent',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {sorted.map((entity) => (
          <EntityCard
            key={entity.id}
            entity={entity}
            selected={selectedEntityId === entity.id}
            onClick={() => selectEntity(entity.id)}
          />
        ))}

        {sorted.length === 0 && (
          <div className="text-center text-zinc-700 text-[10px] tracking-wider py-8">
            NO ENTITIES MATCH FILTERS
          </div>
        )}
      </div>

      {/* Threat Matrix */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        <ThreatMatrix />
      </div>
    </div>
  );
}
