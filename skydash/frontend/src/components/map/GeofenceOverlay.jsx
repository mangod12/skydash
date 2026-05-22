import { Circle, Polygon, Tooltip } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';

export default function GeofenceOverlay() {
  const geofences = useMapStore((s) => s.geofences);

  return (
    <>
      {geofences.filter((f) => f.active !== false).map((fence) => {
        const color = fence.color || '#6366f1';

        if (fence.type === 'circle') {
          return (
            <Circle
              key={fence.id}
              center={[fence.center.lat, fence.center.lng]}
              radius={fence.radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '6 4',
              }}
            >
              {fence.name && (
                <Tooltip direction="top" offset={[0, -10]} permanent={false}>
                  <span className="text-[10px] font-mono">{fence.name}</span>
                </Tooltip>
              )}
            </Circle>
          );
        }

        if (fence.type === 'polygon' && fence.points?.length > 2) {
          return (
            <Polygon
              key={fence.id}
              positions={fence.points.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '6 4',
              }}
            >
              {fence.name && (
                <Tooltip direction="top" offset={[0, -10]} permanent={false}>
                  <span className="text-[10px] font-mono">{fence.name}</span>
                </Tooltip>
              )}
            </Polygon>
          );
        }

        return null;
      })}
    </>
  );
}
