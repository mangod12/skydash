import { Polygon } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';

const FOV_DEG = 60;
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6371000;

/**
 * Compute a rectangular camera footprint on the ground based on
 * drone position, altitude, heading, and field of view.
 * Returns 4 corner coordinates [lat, lng].
 */
function computeFootprint(lat, lng, alt, heading) {
  if (!alt || alt < 5) return null;

  // Ground distance from nadir to edge = alt * tan(FOV/2)
  const halfFovRad = (FOV_DEG / 2) * DEG_TO_RAD;
  const groundDist = alt * Math.tan(halfFovRad);

  // Convert meters to degree offsets (approximate at this scale)
  const dLat = groundDist / EARTH_RADIUS_M * (180 / Math.PI);
  const dLng = dLat / Math.cos(lat * DEG_TO_RAD);

  // Aspect ratio 4:3
  const dLatHalf = dLat;
  const dLngHalf = dLng * 0.75;

  // Rotate corners by heading
  const hdgRad = (heading || 0) * DEG_TO_RAD;
  const cos = Math.cos(hdgRad);
  const sin = Math.sin(hdgRad);

  const corners = [
    [-dLatHalf, -dLngHalf],
    [-dLatHalf,  dLngHalf],
    [ dLatHalf,  dLngHalf],
    [ dLatHalf, -dLngHalf],
  ];

  return corners.map(([dy, dx]) => [
    lat + dy * cos - dx * sin,
    lng + dx * cos + dy * sin,
  ]);
}

export default function DroneFootprint() {
  const pos = useMapStore((s) => s.dronePosition);

  if (!pos) return null;

  const footprint = computeFootprint(pos.lat, pos.lng, pos.alt, pos.heading);
  if (!footprint) return null;

  return (
    <>
      {/* Main footprint */}
      <Polygon
        positions={footprint}
        pathOptions={{
          color: '#22d3ee',
          fillColor: '#22d3ee',
          fillOpacity: 0.04,
          weight: 1,
          opacity: 0.3,
          dashArray: '4 4',
        }}
      />
      {/* Center cross — nadir point indicator */}
      <Polygon
        positions={[
          [footprint[0], footprint[2]],
        ]}
        pathOptions={{
          color: '#22d3ee',
          weight: 0.5,
          opacity: 0.15,
          dashArray: '2 6',
        }}
      />
    </>
  );
}
