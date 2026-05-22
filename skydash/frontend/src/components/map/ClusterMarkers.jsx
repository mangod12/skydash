import { useState, useMemo, useCallback } from 'react';
import { CircleMarker, Tooltip, Circle, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useIntelStore } from '../../stores/intelStore';
import { useEntityNavigation } from '../../hooks/useEntityNavigation';
import { clusterEntities } from '../../utils/clustering';

const THREAT_COLORS = { none: '#71717a', low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
const TYPE_LABELS = { person: 'PERSON', vehicle: 'VEHICLE', building: 'FACILITY', device: 'SIGNAL', event: 'EVENT' };
const THREAT_RADII = { none: 6, low: 7, medium: 8, high: 9, critical: 10 };

function clusterRadius(count) { return Math.min(12 + Math.log2(count) * 6, 32); }

function dominantType(types) {
  if (types.length === 0) return 'MIXED';
  if (types.length === 1) return TYPE_LABELS[types[0]] || types[0].toUpperCase();
  return `${types.length} TYPES`;
}

function SingleEntityMarker({ entity, onEntityContextMenu }) {
  const selectedEntityId = useIntelStore((s) => s.selectedEntityId);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const { showEntityDetail } = useEntityNavigation();

  const style = {
    color: THREAT_COLORS[entity.threatLevel] || THREAT_COLORS.none,
    radius: THREAT_RADII[entity.threatLevel] || 6,
    pulse: entity.threatLevel === 'high' || entity.threatLevel === 'critical',
  };
  const isSelected = selectedEntityId === entity.id;
  const pos = [entity._lat, entity._lng];

  return (
    <span>
      {style.pulse && (
        <Circle
          center={pos}
          radius={150}
          pathOptions={{
            color: style.color, fillColor: style.color,
            fillOpacity: 0.05, weight: 1, dashArray: '4 4', opacity: 0.3,
          }}
        />
      )}
      {isSelected && (
        <Circle
          center={pos}
          radius={80}
          pathOptions={{
            color: '#22d3ee', fillColor: '#22d3ee',
            fillOpacity: 0.08, weight: 2, opacity: 0.6,
          }}
          className="entity-pulse-ring"
        />
      )}
      <CircleMarker
        center={pos}
        radius={style.radius}
        pathOptions={{
          color: isSelected ? '#22d3ee' : style.color,
          fillColor: isSelected ? '#22d3ee' : style.color,
          fillOpacity: isSelected ? 0.7 : 0.5,
          weight: isSelected ? 3 : 2,
          opacity: 0.9,
        }}
        eventHandlers={{
          click: () => selectEntity(entity.id),
          contextmenu: (e) => {
            e.originalEvent?.preventDefault?.();
            e.originalEvent?.stopPropagation?.();
            if (onEntityContextMenu) {
              onEntityContextMenu(
                e.originalEvent?.clientX ?? 0,
                e.originalEvent?.clientY ?? 0,
                entity,
              );
            }
          },
        }}
      >
        <Tooltip direction="top" offset={[0, -10]} permanent={false}>
          <div className="text-[10px] font-mono space-y-0.5">
            <div className="font-bold text-[11px]">{entity.name}</div>
            <div style={{ color: style.color }}>
              {TYPE_LABELS[entity.type] || entity.type?.toUpperCase()} | {entity.threatLevel?.toUpperCase()} | {entity.confidence}%
            </div>
            <div className="text-zinc-500">{entity.source}</div>
          </div>
        </Tooltip>
        <Popup closeButton={false} className="entity-popup">
          <div className="text-[10px] font-mono space-y-1.5 min-w-[140px]">
            <div className="font-bold text-[11px]">{entity.name}</div>
            <div style={{ color: style.color }}>
              {TYPE_LABELS[entity.type] || entity.type?.toUpperCase()} | {entity.threatLevel?.toUpperCase()}
            </div>
            <div className="text-zinc-500">CONF: {entity.confidence}%</div>
            <button
              onClick={(ev) => { ev.stopPropagation(); showEntityDetail(entity.id); }}
              className="mt-1 w-full px-2 py-1 text-[10px] font-semibold tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer"
            >
              VIEW DETAIL
            </button>
          </div>
        </Popup>
      </CircleMarker>
    </span>
  );
}

function ClusterBadge({ cluster }) {
  const map = useMap();
  const color = THREAT_COLORS[cluster.maxThreat] || THREAT_COLORS.none;
  const r = clusterRadius(cluster.count);

  const handleClick = useCallback(() => {
    map.flyTo([cluster.lat, cluster.lng], Math.min(map.getZoom() + 3, 18), { duration: 0.6 });
  }, [map, cluster.lat, cluster.lng]);

  return (
    <CircleMarker
      center={[cluster.lat, cluster.lng]}
      radius={r}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.25,
        weight: 2,
        opacity: 0.85,
      }}
      eventHandlers={{ click: handleClick }}
    >
      <Tooltip direction="top" offset={[0, -r]} permanent={false}>
        <div className="text-[10px] font-mono space-y-0.5">
          <div className="font-bold text-[11px]">{cluster.count} ENTITIES</div>
          <div style={{ color }}>{dominantType(cluster.types)} | THREAT: {cluster.maxThreat.toUpperCase()}</div>
        </div>
      </Tooltip>
      <Popup closeButton={false}>
        <div className="text-[10px] font-mono space-y-1 min-w-[120px]">
          <div className="font-bold text-[11px]">{cluster.count} ENTITIES</div>
          <div style={{ color }}>{dominantType(cluster.types)}</div>
          <div className="text-zinc-500">MAX THREAT: {cluster.maxThreat.toUpperCase()}</div>
          <div className="text-zinc-600 text-[9px] mt-1">
            {cluster.entities.slice(0, 4).map((e) => e.name).join(', ')}
            {cluster.count > 4 ? ` +${cluster.count - 4} more` : ''}
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function ClusterMarkers({ onEntityContextMenu }) {
  const entities = useIntelStore((s) => s.entities);
  const [zoom, setZoom] = useState(14);

  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
    zoom: (e) => setZoom(e.target.getZoom()),
  });

  const geoEntities = useMemo(
    () => entities.filter((e) => e.coordinates),
    [entities],
  );

  const clusters = useMemo(
    () => clusterEntities(geoEntities, zoom),
    [geoEntities, zoom],
  );

  return (
    <>
      {clusters.map((cluster, idx) =>
        cluster.count === 1 ? (
          <SingleEntityMarker
            key={cluster.entities[0].id}
            entity={cluster.entities[0]}
            onEntityContextMenu={onEntityContextMenu}
          />
        ) : (
          <ClusterBadge
            key={`cluster-${idx}-${cluster.lat.toFixed(4)}-${cluster.lng.toFixed(4)}`}
            cluster={cluster}
          />
        ),
      )}
    </>
  );
}
