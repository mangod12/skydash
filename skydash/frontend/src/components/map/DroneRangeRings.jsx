import { Circle, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { predictTrack, RANGE_RING_RADII_M } from '../../utils/prediction';

/** Range rings around the drone plus a 2-minute predicted track from speed and heading. */
export default function DroneRangeRings() {
  const pos = useMapStore((s) => s.dronePosition);
  const speed = useTelemetryStore((s) => s.data?.ground_speed);
  // Leaflet throws on NaN coordinates, so draw nothing without a usable fix.
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return null;

  const track = predictTrack(pos, speed, pos.heading, 120, 30);

  return (
    <>
      {RANGE_RING_RADII_M.map((r) => (
        <Circle
          key={r}
          center={[pos.lat, pos.lng]}
          radius={r}
          interactive={false}
          pathOptions={{ color: '#c7d2fe', weight: 1.5, opacity: 0.85, dashArray: '4 6', fill: false }}
        />
      ))}
      {track.length > 1 && (
        <>
          <Polyline
            positions={track}
            interactive={false}
            pathOptions={{ color: '#22d3ee', weight: 2, opacity: 0.8, dashArray: '2 6' }}
          />
          {track.slice(1).map((p, i) => (
            <CircleMarker key={i} center={p} radius={3} interactive={false}
              pathOptions={{ color: '#22d3ee', weight: 1, fillOpacity: 0.9 }}>
              {i === track.length - 2 && <Tooltip permanent direction="right" className="text-[9px]">+{(i + 1) * 30}s</Tooltip>}
            </CircleMarker>
          ))}
        </>
      )}
    </>
  );
}
