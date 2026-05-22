import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const PATTERN_COLORS = {
  orbit: '#22d3ee',
  grid: '#f59e0b',
  waypoint: '#8b5cf6',
};

const THREAT_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

function computeCentroid(fleet, entities) {
  const points = [];
  fleet.forEach((d) => {
    if (d.gps?.latitude && d.gps?.longitude) {
      points.push([d.gps.latitude, d.gps.longitude]);
    }
  });
  entities.forEach((e) => {
    if (e.coordinates) points.push(e.coordinates);
  });
  if (points.length === 0) return [37.7755, -122.4180];
  const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [lat, lng];
}

export default function DashboardMiniMap() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const entities = useIntelStore((s) => s.entities);

  const center = useMemo(
    () => computeCentroid(fleet, entities),
    [fleet, entities],
  );

  return (
    <div className="h-[200px] rounded-xl overflow-hidden border border-white/[0.08]">
      <MapContainer
        center={center}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ background: '#09090b' }}
      >
        <TileLayer url={TILE_URL} maxZoom={20} maxNativeZoom={20} />

        {/* Fleet drone dots */}
        {fleet.map((drone) => {
          if (!drone.gps?.latitude) return null;
          const color = PATTERN_COLORS[drone.pattern] || '#22d3ee';
          return (
            <CircleMarker
              key={drone.drone_id}
              center={[drone.gps.latitude, drone.gps.longitude]}
              radius={5}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 2,
                opacity: 1,
              }}
            />
          );
        })}

        {/* Entity diamonds (rendered as small circle markers) */}
        {entities
          .filter((e) => e.coordinates)
          .map((entity) => {
            const color = THREAT_COLORS[entity.threatLevel] || '#71717a';
            return (
              <CircleMarker
                key={entity.id}
                center={entity.coordinates}
                radius={3}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.7,
                  weight: 1.5,
                  opacity: 0.8,
                }}
              />
            );
          })}
      </MapContainer>
    </div>
  );
}
