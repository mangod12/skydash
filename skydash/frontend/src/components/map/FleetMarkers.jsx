import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useTelemetryStore } from '../../stores/telemetryStore';

const PATTERN_STYLES = {
  orbit: { color: '#22d3ee', label: 'ORBIT' },
  grid: { color: '#f59e0b', label: 'GRID' },
  waypoint: { color: '#8b5cf6', label: 'WAYPOINT' },
};

function createFleetIcon(color, heading = 0) {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:36px;height:36px;position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;border:1px solid ${color}40;animation:dronePulse 3s ease-out infinite;"></div>
        <div style="width:24px;height:24px;border-radius:50%;border:1.5px solid ${color}90;display:flex;align-items:center;justify-content:center;background:rgba(9,9,11,0.7);box-shadow:0 0 12px ${color}50;">
          <svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${heading}deg);">
            <polygon points="7,1 4,11 7,9 10,11" fill="${color}" stroke="rgba(255,255,255,0.3)" stroke-width="0.3"/>
          </svg>
        </div>
      </div>
      <style>@keyframes dronePulse{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2);opacity:0}}</style>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function FleetMarkers() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const activeDroneId = useTelemetryStore((s) => s.activeDroneId);

  const secondaryDrones = fleet.filter((d) => d.drone_id !== activeDroneId);

  return (
    <>
      {secondaryDrones.map((drone) => {
        if (!drone.gps) return null;
        const style = PATTERN_STYLES[drone.pattern] || PATTERN_STYLES.orbit;
        const icon = createFleetIcon(style.color, drone.attitude?.yaw ?? 0);

        return (
          <Marker
            key={drone.drone_id}
            position={[drone.gps.latitude, drone.gps.longitude]}
            icon={icon}
          >
            <Tooltip direction="top" offset={[0, -20]} permanent={false}>
              <div className="text-[10px] font-mono">
                <div className="font-bold">{drone.drone_id}</div>
                <div>{style.label} | {drone.altitude?.toFixed(0)}m | {drone.battery_voltage?.toFixed(1)}V</div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
