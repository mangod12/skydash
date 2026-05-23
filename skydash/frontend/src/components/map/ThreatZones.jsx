import { Circle } from 'react-leaflet';
import { useIntelStore } from '../../stores/intelStore';

const THREAT_ZONES = {
  critical: { radius: 400, color: '#dc2626', opacity: 0.08, border: 0.25 },
  high:     { radius: 300, color: '#ef4444', opacity: 0.06, border: 0.2 },
  medium:   { radius: 200, color: '#f59e0b', opacity: 0.04, border: 0.15 },
};

export default function ThreatZones() {
  const entities = useIntelStore((s) => s.entities);

  const threats = entities.filter(
    (e) => e.coordinates && THREAT_ZONES[e.threatLevel],
  );

  return (
    <>
      {threats.map((entity) => {
        const zone = THREAT_ZONES[entity.threatLevel];
        const pos = [entity.coordinates[0], entity.coordinates[1]];

        return (
          <span key={`tz-${entity.id}`}>
            {/* Outer glow ring */}
            <Circle
              center={pos}
              radius={zone.radius}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: zone.opacity,
                weight: 1,
                opacity: zone.border,
                dashArray: '6 4',
              }}
            />
            {/* Inner danger ring */}
            <Circle
              center={pos}
              radius={zone.radius * 0.4}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: zone.opacity * 2,
                weight: 0.5,
                opacity: zone.border * 0.6,
              }}
            />
          </span>
        );
      })}
    </>
  );
}
