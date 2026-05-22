import { useMapEvents, Polyline, CircleMarker } from 'react-leaflet';
import { distanceBetween } from '../../utils/coordinates';

export default function MeasureTool({ active, points, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!active || points.length === 0) return null;

  const positions = points.map((p) => [p.lat, p.lng]);

  return (
    <>
      {/* Line between points */}
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{
            color: '#f59e0b',
            weight: 2,
            dashArray: '6 6',
            opacity: 0.8,
          }}
        />
      )}

      {/* Point markers */}
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={4}
          pathOptions={{
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}
    </>
  );
}

export function MeasureOverlay({ active, points }) {
  if (!active || points.length < 2) return null;

  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    totalDist += distanceBetween(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }

  const formatted = totalDist < 1000
    ? `${totalDist.toFixed(1)} m`
    : `${(totalDist / 1000).toFixed(3)} km`;

  return (
    <div className="absolute top-14 right-3 z-20">
      <div className="bg-zinc-900/90 backdrop-blur-sm border border-amber-500/30 rounded-lg px-3 py-2 text-center">
        <div className="text-[9px] text-amber-500/70 tracking-wider font-semibold">DISTANCE</div>
        <div className="text-sm font-mono font-bold tabular-nums text-amber-400">{formatted}</div>
        <div className="text-[9px] text-zinc-600 mt-0.5">{points.length} points</div>
      </div>
    </div>
  );
}
