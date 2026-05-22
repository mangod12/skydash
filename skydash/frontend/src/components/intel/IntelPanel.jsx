import { useState } from 'react';
import { Search } from 'lucide-react';
import EntityCard from './EntityCard';
import ThreatMatrix from './ThreatMatrix';
import EntityFilterBar, { useEntityFilters } from './EntityFilterBar';
import VirtualList from '../common/VirtualList';
import ContextMenu, { useContextMenu } from '../common/ContextMenu';
import useEntityContextMenu from '../../hooks/useEntityContextMenu';
import { useIntelStore } from '../../stores/intelStore';

export default function IntelPanel() {
  const { entities, selectedEntityId, selectEntity } = useIntelStore();
  const [search, setSearch] = useState('');
  const { menu, show, hide } = useContextMenu();
  const openEntityMenu = useEntityContextMenu(show);

  const searchFiltered = entities.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const { filters, toggleType, updateFilter, filtered, resultCount, totalCount } =
    useEntityFilters(searchFiltered);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            INTELLIGENCE
          </h3>
          <span className="text-[9px] font-mono tabular-nums text-zinc-600">
            {resultCount} of {totalCount} entities
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

        {/* Filter bar */}
        <EntityFilterBar filters={filters} toggleType={toggleType} updateFilter={updateFilter} />
      </div>

      {/* Entity list */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-zinc-700 text-[10px] tracking-wider py-8">
            NO ENTITIES MATCH FILTERS
          </div>
        </div>
      ) : (
        <VirtualList
          items={filtered}
          itemHeight={72}
          className="flex-1 p-2"
          renderItem={(entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              selected={selectedEntityId === entity.id}
              onClick={() => selectEntity(entity.id)}
              onContextMenu={openEntityMenu}
            />
          )}
        />
      )}

      {/* Threat Matrix */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        <ThreatMatrix />
      </div>

      {/* Context menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={hide} />}
    </div>
  );
}
