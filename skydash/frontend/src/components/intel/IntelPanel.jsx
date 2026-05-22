import { useState, useCallback } from 'react';
import { Search, CheckSquare } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import EntityCard from './EntityCard';
import ThreatMatrix from './ThreatMatrix';
import EntityFilterBar, { useEntityFilters } from './EntityFilterBar';
import BulkActionsBar from './BulkActionsBar';
import BookmarkBar from '../common/BookmarkBar';
import VirtualList from '../common/VirtualList';
import ContextMenu, { useContextMenu } from '../common/ContextMenu';
import useEntityContextMenu from '../../hooks/useEntityContextMenu';
import { useIntelStore } from '../../stores/intelStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

export default function IntelPanel() {
  const { entities, selectedEntityId, selectEntity } = useIntelStore();
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { menu, show, hide } = useContextMenu();
  const openEntityMenu = useEntityContextMenu(show);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const searchFiltered = entities.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const { filters, setFilters, toggleType, updateFilter, filtered, resultCount, totalCount } =
    useEntityFilters(searchFiltered);

  const handleBookmark = useCallback((action, payload) => {
    if (action === 'save') {
      useBookmarkStore.getState().addBookmark({
        name: payload,
        type: 'filter',
        config: { types: filters.types, threat: filters.threat, confidence: filters.confidence, sort: filters.sort, searchQuery: search },
      });
    } else if (action === 'apply') {
      const { config } = payload;
      setFilters({ types: config.types || [], threat: config.threat || null, confidence: config.confidence || null, sort: config.sort || 'name' });
      if (config.searchQuery != null) setSearch(config.searchQuery);
    }
  }, [filters, search, setFilters]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            INTELLIGENCE
          </h3>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <span className="text-[9px] font-mono tabular-nums text-indigo-400">
                {selectedIds.size} selected
              </span>
            )}
            <span className="text-[9px] font-mono tabular-nums text-zinc-600">
              {resultCount} of {totalCount} entities
            </span>
            <button
              onClick={() => { setSelectMode((p) => !p); if (selectMode) setSelectedIds(new Set()); }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] tracking-wider transition-colors ${
                selectMode ? 'bg-indigo-500/15 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <CheckSquare size={10} />
              SELECT
            </button>
          </div>
        </div>
        {selectMode && (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set(filtered.map((e) => e.id)))}
              className="text-[9px] text-zinc-500 hover:text-zinc-300 tracking-wider transition-colors">SELECT ALL</button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-[9px] text-zinc-500 hover:text-zinc-300 tracking-wider transition-colors">DESELECT ALL</button>
          </div>
        )}

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

        {/* Bookmarks */}
        <BookmarkBar type="filter" onApply={handleBookmark} />

        {/* Filter bar */}
        <EntityFilterBar filters={filters} toggleType={toggleType} updateFilter={updateFilter} />
      </div>

      {/* Entity list */}
      <div className="flex-1 relative min-h-0">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-zinc-700 text-[10px] tracking-wider py-8">
              NO ENTITIES MATCH FILTERS
            </div>
          </div>
        ) : (
          <VirtualList
            items={filtered}
            itemHeight={72}
            className="h-full p-2"
            renderItem={(entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                selected={selectedEntityId === entity.id}
                selectable={selectMode}
                checked={selectedIds.has(entity.id)}
                onClick={() => selectMode ? toggleSelect(entity.id) : selectEntity(entity.id)}
                onContextMenu={openEntityMenu}
              />
            )}
          />
        )}

        {/* Bulk actions bar */}
        <AnimatePresence>
          {selectMode && selectedIds.size > 0 && (
            <BulkActionsBar selectedIds={selectedIds} onClear={clearSelection} />
          )}
        </AnimatePresence>
      </div>

      {/* Threat Matrix */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        <ThreatMatrix />
      </div>

      {/* Context menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={hide} />}
    </div>
  );
}
