import { CircleMarker, Tooltip, Circle, Popup } from 'react-leaflet';
import { useIntelStore } from '../../stores/intelStore';
import { useEntityNavigation } from '../../hooks/useEntityNavigation';
import { THREAT_COLORS, COLORS } from '../../utils/designTokens';

const THREAT_STYLES = {
  none: { color: THREAT_COLORS.none, radius: 6, pulse: false },
  low: { color: THREAT_COLORS.low, radius: 7, pulse: false },
  medium: { color: THREAT_COLORS.medium, radius: 8, pulse: true },
  high: { color: THREAT_COLORS.high, radius: 9, pulse: true },
  critical: { color: THREAT_COLORS.critical, radius: 10, pulse: true },
};

const TYPE_LABELS = {
  person: 'PERSON',
  vehicle: 'VEHICLE',
  building: 'FACILITY',
  device: 'SIGNAL',
  event: 'EVENT',
};

export default function EntityMarkers({ onEntityContextMenu }) {
  const entities = useIntelStore((s) => s.entities);
  const selectedEntityId = useIntelStore((s) => s.selectedEntityId);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const { showEntityDetail } = useEntityNavigation();

  return (
    <>
      {entities
        .filter((e) => e.coordinates)
        .map((entity) => {
          const style = THREAT_STYLES[entity.threatLevel] || THREAT_STYLES.none;
          const isSelected = selectedEntityId === entity.id;

          return (
            <span key={entity.id}>
              {/* Threat radius ring for high/critical */}
              {(entity.threatLevel === 'high' || entity.threatLevel === 'critical') && (
                <Circle
                  center={entity.coordinates}
                  radius={150}
                  pathOptions={{
                    color: style.color,
                    fillColor: style.color,
                    fillOpacity: 0.05,
                    weight: 1,
                    dashArray: '4 4',
                    opacity: 0.3,
                  }}
                />
              )}

              {/* Selected entity pulse ring */}
              {isSelected && (
                <Circle
                  center={entity.coordinates}
                  radius={80}
                  pathOptions={{
                    color: COLORS.dataLight,
                    fillColor: COLORS.dataLight,
                    fillOpacity: 0.08,
                    weight: 2,
                    opacity: 0.6,
                  }}
                  className="entity-pulse-ring"
                />
              )}

              {/* Main marker */}
              <CircleMarker
                center={entity.coordinates}
                radius={style.radius}
                pathOptions={{
                  color: isSelected ? COLORS.dataLight : style.color,
                  fillColor: isSelected ? COLORS.dataLight : style.color,
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
                      {TYPE_LABELS[entity.type] || entity.type.toUpperCase()} | {entity.threatLevel.toUpperCase()} | {entity.confidence}%
                    </div>
                    <div className="text-zinc-500">{entity.source}</div>
                  </div>
                </Tooltip>

                <Popup closeButton={false} className="entity-popup">
                  <div className="text-[10px] font-mono space-y-1.5 min-w-[140px]">
                    <div className="font-bold text-[11px]">{entity.name}</div>
                    <div style={{ color: style.color }}>
                      {TYPE_LABELS[entity.type] || entity.type.toUpperCase()} | {entity.threatLevel.toUpperCase()}
                    </div>
                    <div className="text-zinc-500">CONF: {entity.confidence}%</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showEntityDetail(entity.id);
                      }}
                      className="mt-1 w-full px-2 py-1 text-[10px] font-semibold tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer"
                    >
                      VIEW DETAIL
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            </span>
          );
        })}
    </>
  );
}
