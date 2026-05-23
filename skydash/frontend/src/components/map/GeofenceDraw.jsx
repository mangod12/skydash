import { useState } from 'react';
import { useMapEvents, CircleMarker, Polyline, Polygon } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { toast } from '../common/Toast';
import { COLORS } from '../../utils/designTokens';

export default function GeofenceDraw({ active, mode, onComplete }) {
  const [points, setPoints] = useState([]);
  const [center, setCenter] = useState(null);
  const addGeofence = useMapStore((s) => s.addGeofence);

  useMapEvents({
    click(e) {
      if (!active) return;
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (mode === 'circle') {
        if (!center) {
          setCenter(pt);
        } else {
          // Second click = radius
          const R = 6371000;
          const dLat = (pt.lat - center.lat) * Math.PI / 180;
          const dLng = (pt.lng - center.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(center.lat * Math.PI / 180) * Math.cos(pt.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          addGeofence({
            id: `gf-${Date.now()}`,
            name: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 99)}`,
            type: 'circle',
            center,
            radius: Math.round(radius),
            color: COLORS.brand,
            active: true,
            alertOnEntry: true,
            alertOnExit: false,
            createdAt: new Date().toISOString(),
          });
          toast(`Geofence created: ${Math.round(radius)}m radius`, 'success');
          setCenter(null);
          onComplete?.();
        }
      } else {
        // Polygon mode
        setPoints((prev) => [...prev, pt]);
      }
    },
    dblclick(e) {
      if (!active || mode !== 'polygon' || points.length < 3) return;
      e.originalEvent.preventDefault();

      addGeofence({
        id: `gf-${Date.now()}`,
        name: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 99)}`,
        type: 'polygon',
        points: [...points],
        color: COLORS.brand,
        active: true,
        alertOnEntry: true,
        alertOnExit: false,
        createdAt: new Date().toISOString(),
      });
      toast(`Geofence created: ${points.length}-point polygon`, 'success');
      setPoints([]);
      onComplete?.();
    },
  });

  if (!active) return null;

  return (
    <>
      {/* Circle mode: show center + radius preview */}
      {mode === 'circle' && center && (
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={5}
          pathOptions={{ color: COLORS.warning, fillColor: COLORS.warning, fillOpacity: 0.8 }}
        />
      )}

      {/* Polygon mode: show vertices + lines */}
      {mode === 'polygon' && points.length > 0 && (
        <>
          {points.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={4}
              pathOptions={{ color: COLORS.warning, fillColor: COLORS.warning, fillOpacity: 0.8 }}
            />
          ))}
          {points.length > 1 && (
            <Polyline
              positions={points.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: COLORS.warning, weight: 2, dashArray: '6 4' }}
            />
          )}
          {points.length >= 3 && (
            <Polygon
              positions={points.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: COLORS.warning, fillColor: COLORS.warning, fillOpacity: 0.06, weight: 1, dashArray: '6 4' }}
            />
          )}
        </>
      )}
    </>
  );
}
