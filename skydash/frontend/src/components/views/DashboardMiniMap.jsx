import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { PATTERN_COLORS, THREAT_COLORS, COLORS } from '../../utils/designTokens';
import 'leaflet/dist/leaflet.css';
import { DARK_BASEMAP } from '../../utils/basemap';


const isPoint = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const dronePoint = (d) => (Number.isFinite(d?.gps?.latitude) && Number.isFinite(d?.gps?.longitude) ? [d.gps.latitude, d.gps.longitude] : null);

function computeCentroid(fleet, entities) {
  const points = [];
  fleet.forEach((d) => {
    const pt = dronePoint(d);
    if (pt) points.push(pt);
  });
  entities.forEach((e) => {
    if (isPoint(e.coordinates)) points.push(e.coordinates);
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
        style={{ background: COLORS.surface }}
      >
        <TileLayer url={DARK_BASEMAP.url} attribution={DARK_BASEMAP.attribution} className={DARK_BASEMAP.className} maxZoom={DARK_BASEMAP.maxZoom} maxNativeZoom={DARK_BASEMAP.maxNativeZoom} />

        {/* Fleet drone dots */}
        {fleet.map((drone) => {
          const pt = dronePoint(drone);
          if (!pt) return null;
          const color = PATTERN_COLORS[drone.pattern] || COLORS.dataLight;
          return (
            <CircleMarker
              key={drone.drone_id}
              center={pt}
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
          .filter((e) => isPoint(e.coordinates))
          .map((entity) => {
            const color = THREAT_COLORS[entity.threatLevel] || COLORS.muted;
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
