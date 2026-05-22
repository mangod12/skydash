import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';

const ENTITY_TYPES = ['vehicle', 'person', 'building', 'device', 'event', 'organization'];
const THREAT_LEVELS = ['critical', 'high', 'medium', 'low', 'none'];
const CONFIDENCE_LEVELS = [
  { id: 'high', label: 'HIGH 80+' },
  { id: 'medium', label: 'MED 50-79' },
  { id: 'low', label: 'LOW <50' },
];
const SORT_OPTIONS = [
  { id: 'name', label: 'NAME' },
  { id: 'threat', label: 'THREAT' },
  { id: 'confidence', label: 'CONFIDENCE' },
  { id: 'recent', label: 'RECENT' },
];
const THREAT_ORDER = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

const ACTIVE = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
const INACTIVE = 'text-zinc-600 border border-white/[0.04] hover:bg-white/[0.04]';

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider transition-all duration-150',
        active ? ACTIVE : INACTIVE,
        active && 'scale-[1.02]',
      )}
    >
      {label}
    </button>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[8px] font-semibold tracking-[0.15em] text-zinc-600 uppercase mr-0.5">
        {label}
      </span>
      {children}
    </div>
  );
}

export function useEntityFilters(entities) {
  const [filters, setFilters] = useState({
    types: [],
    threat: null,
    confidence: null,
    sort: 'name',
  });

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleType = useCallback((type) => {
    setFilters((prev) => {
      const types = prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type];
      return { ...prev, types };
    });
  }, []);

  const filtered = useMemo(() => {
    let result = [...entities];

    if (filters.types.length > 0)
      result = result.filter((e) => filters.types.includes(e.type));

    if (filters.threat)
      result = result.filter((e) => e.threatLevel === filters.threat);

    if (filters.confidence === 'high') result = result.filter((e) => e.confidence >= 80);
    else if (filters.confidence === 'medium') result = result.filter((e) => e.confidence >= 50 && e.confidence < 80);
    else if (filters.confidence === 'low') result = result.filter((e) => e.confidence < 50);

    if (filters.sort === 'threat') result.sort((a, b) => (THREAT_ORDER[a.threatLevel] ?? 5) - (THREAT_ORDER[b.threatLevel] ?? 5));
    else if (filters.sort === 'confidence') result.sort((a, b) => b.confidence - a.confidence);
    else if (filters.sort === 'recent') result.sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
    else result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  }, [entities, filters]);

  return { filters, setFilters, updateFilter, toggleType, filtered, resultCount: filtered.length, totalCount: entities.length };
}

export default function EntityFilterBar({ filters, toggleType, updateFilter }) {
  return (
    <div className="rounded-lg bg-white/[0.02] backdrop-blur-md border border-white/[0.06] p-2 space-y-1.5">
      <FilterGroup label="TYPE">
        <Chip label="ALL" active={filters.types.length === 0} onClick={() => updateFilter('types', [])} />
        {ENTITY_TYPES.map((t) => (
          <Chip key={t} label={t.toUpperCase()} active={filters.types.includes(t)} onClick={() => toggleType(t)} />
        ))}
      </FilterGroup>

      <FilterGroup label="THREAT">
        <Chip label="ALL" active={!filters.threat} onClick={() => updateFilter('threat', null)} />
        {THREAT_LEVELS.map((t) => (
          <Chip key={t} label={t.toUpperCase()} active={filters.threat === t} onClick={() => updateFilter('threat', filters.threat === t ? null : t)} />
        ))}
      </FilterGroup>

      <FilterGroup label="CONF">
        <Chip label="ALL" active={!filters.confidence} onClick={() => updateFilter('confidence', null)} />
        {CONFIDENCE_LEVELS.map((c) => (
          <Chip key={c.id} label={c.label} active={filters.confidence === c.id} onClick={() => updateFilter('confidence', filters.confidence === c.id ? null : c.id)} />
        ))}
      </FilterGroup>

      <FilterGroup label="SORT">
        {SORT_OPTIONS.map((s) => (
          <Chip key={s.id} label={s.label} active={filters.sort === s.id} onClick={() => updateFilter('sort', s.id)} />
        ))}
      </FilterGroup>
    </div>
  );
}
