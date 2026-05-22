import { CircleMarker, Tooltip, Circle } from 'react-leaflet';
import { useIntelStore } from '../../stores/intelStore';

const THREAT_STYLES = {
  none: { color: '#71717a', radius: 6, pulse: false },
  low: { color: '#10b981', radius: 7, pulse: false },
  medium: { color: '#f59e0b', radius: 8, pulse: true },
  high: { color: '#ef4444', radius: 9, pulse: true },
  critical: { color: '#dc2626', radius: 10, pulse: true },
};

const TYPE_LABELS = {
  person: 'PERSON',
  vehicle: 'VEHICLE',
  building: 'FACILITY',
  device: 'SIGNAL',
  event: 'EVENT',
};

export default function EntityMarkers() {
  const entities = useIntelStore((s) => s.entities);
  const selectEntity = useIntelStore((s) => s.selectEntity);

  return (
    <>
      {entities
        .filter((e) => e.coordinates)
        .map((entity) => {
          const style = THREAT_STYLES[entity.threatLevel] || THREAT_STYLES.none;

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

              {/* Main marker */}
              <CircleMarker
                center={entity.coordinates}
                radius={style.radius}
                pathOptions={{
                  color: style.color,
                  fillColor: style.color,
                  fillOpacity: 0.5,
                  weight: 2,
                  opacity: 0.9,
                }}
                eventHandlers={{
                  click: () => selectEntity(entity.id),
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
              </CircleMarker>
            </span>
          );
        })}
    </>
  );
}
