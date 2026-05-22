import { Circle, Polygon } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';

export default function GeofenceOverlay() {
  const geofences = useMapStore((s) => s.geofences);

  return (
    <>
      {geofences.map((fence) => {
        if (fence.type === 'circle') {
          return (
            <Circle
              key={fence.id}
              center={[fence.center.lat, fence.center.lng]}
              radius={fence.radius}
              pathOptions={{
                color: fence.alert ? '#ef4444' : '#6366f1',
                fillColor: fence.alert ? '#ef4444' : '#6366f1',
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '6 4',
              }}
            />
          );
        }

        if (fence.type === 'polygon' && fence.points?.length > 2) {
          return (
            <Polygon
              key={fence.id}
              positions={fence.points.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: fence.alert ? '#ef4444' : '#6366f1',
                fillColor: fence.alert ? '#ef4444' : '#6366f1',
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '6 4',
              }}
            />
          );
        }

        return null;
      })}
    </>
  );
}
