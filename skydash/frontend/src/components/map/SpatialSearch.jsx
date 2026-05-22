import { useState, useMemo, useCallback } from 'react';
import { useMapEvents, Circle, CircleMarker } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useIntelStore } from '../../stores/intelStore';
import { distanceBetween } from '../../utils/coordinates';

const THREAT_COLORS = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
  none: '#71717a',
};

const MIN_RADIUS = 100;
const MAX_RADIUS = 5000;
const DEFAULT_RADIUS = 500;

/** Map click handler — sets search center when spatial search is active */
export function SpatialSearchMapHandler({ active, onSetCenter }) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onSetCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Circle overlay rendered inside MapContainer */
export function SpatialSearchOverlay({ center, radius, highlightedId }) {
  if (!center) return null;

  return (
    <>
      <Circle
        center={[center.lat, center.lng]}
        radius={radius}
        pathOptions={{
          color: '#6366f1',
          weight: 2,
          dashArray: '8 4',
          fillColor: '#6366f1',
          fillOpacity: 0.08,
        }}
      />
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={4}
        pathOptions={{
          color: '#6366f1',
          fillColor: '#6366f1',
          fillOpacity: 1,
          weight: 2,
        }}
      />
    </>
  );
}

/** Results panel rendered outside MapContainer as HTML overlay */
export default function SpatialSearchPanel({
  active, center, radius, onRadiusChange, onClose, onHighlight,
}) {
  const entities = useIntelStore((s) => s.entities);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const [hoveredId, setHoveredId] = useState(null);

  const results = useMemo(() => {
    if (!center) return [];
    return entities
      .filter((e) => e.coordinates)
      .map((e) => ({
        ...e,
        distance: distanceBetween(center.lat, center.lng, e.coordinates[0], e.coordinates[1]),
      }))
      .filter((e) => e.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }, [entities, center, radius]);

  const formatRadius = useCallback((r) => {
    return r >= 1000 ? `${(r / 1000).toFixed(1)}km` : `${r}m`;
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-14 left-3 z-20 w-64"
        >
          <div className="bg-zinc-900/90 backdrop-blur-md border border-white/[0.08] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-[0.15em] text-indigo-400">
                  SPATIAL SEARCH
                </span>
                <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                  {formatRadius(radius)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Radius slider */}
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <input
                type="range"
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={50}
                value={radius}
                onChange={(e) => onRadiusChange(Number(e.target.value))}
                className="w-full h-1 accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-0.5">
                <span>{formatRadius(MIN_RADIUS)}</span>
                <span>{formatRadius(MAX_RADIUS)}</span>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[160px] overflow-y-auto">
              {!center && (
                <div className="px-3 py-3 text-[10px] text-zinc-500 text-center tracking-wide">
                  CLICK MAP TO SET CENTER
                </div>
              )}
              {center && results.length === 0 && (
                <div className="px-3 py-3 text-[10px] text-zinc-500 text-center tracking-wide">
                  NO ENTITIES IN RANGE
                </div>
              )}
              {results.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => selectEntity(entity.id)}
                  onMouseEnter={() => { setHoveredId(entity.id); onHighlight(entity.id); }}
                  onMouseLeave={() => { setHoveredId(null); onHighlight(null); }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                    hoveredId === entity.id
                      ? 'bg-indigo-500/10'
                      : 'hover:bg-white/[0.04]',
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: THREAT_COLORS[entity.threatLevel] || THREAT_COLORS.none }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-zinc-300 truncate">{entity.name}</div>
                  </div>
                  <span className="text-[9px] font-mono tabular-nums text-zinc-500 flex-shrink-0">
                    {entity.distance < 1000
                      ? `${Math.round(entity.distance)}m`
                      : `${(entity.distance / 1000).toFixed(1)}km`}
                  </span>
                  <span className={clsx(
                    'text-[9px] font-semibold tracking-wider flex-shrink-0',
                    entity.threatLevel === 'critical' && 'text-red-400',
                    entity.threatLevel === 'high' && 'text-red-400',
                    entity.threatLevel === 'medium' && 'text-amber-400',
                    entity.threatLevel === 'low' && 'text-emerald-400',
                  )}>
                    {entity.threatLevel?.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Footer count */}
            {center && (
              <div className="px-3 py-1.5 border-t border-white/[0.06] text-[9px] font-mono text-zinc-600 tracking-wide">
                {results.length} {results.length === 1 ? 'ENTITY' : 'ENTITIES'} FOUND
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
