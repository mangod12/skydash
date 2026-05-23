import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';

function createDroneIcon(heading = 0) {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:56px;height:56px;position:relative;display:flex;align-items:center;justify-content:center;">
        <!-- Outer pulse -->
        <div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid rgba(99,102,241,0.2);animation:dronePulse 2.5s ease-out infinite;"></div>
        <!-- Second pulse (offset) -->
        <div style="position:absolute;inset:-2px;border-radius:50%;border:1px solid rgba(99,102,241,0.15);animation:dronePulse 2.5s ease-out infinite 0.8s;"></div>
        <!-- Glow background -->
        <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.25) 0%,transparent 70%);"></div>
        <!-- Main body -->
        <div style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(99,102,241,0.7);display:flex;align-items:center;justify-content:center;background:rgba(9,9,11,0.8);backdrop-filter:blur(16px);box-shadow:0 0 20px rgba(99,102,241,0.4),inset 0 0 10px rgba(99,102,241,0.1);">
          <svg width="22" height="22" viewBox="0 0 22 22" style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 4px rgba(99,102,241,0.6));">
            <polygon points="11,1 7,16 11,13 15,16" fill="#818cf8" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/>
            <polygon points="11,1 7,16 11,13 15,16" fill="url(#droneGrad)" opacity="0.5"/>
            <defs><linearGradient id="droneGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="white" stop-opacity="0.6"/><stop offset="100%" stop-color="white" stop-opacity="0"/></linearGradient></defs>
          </svg>
        </div>
        <!-- Center beacon -->
        <div style="position:absolute;width:4px;height:4px;background:#c7d2fe;border-radius:50%;box-shadow:0 0 6px #c7d2fe,0 0 12px rgba(199,210,254,0.4);animation:beacon 1.5s ease-in-out infinite;"></div>
      </div>
      <style>
        @keyframes dronePulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes beacon{0%,100%{opacity:1}50%{opacity:0.4}}
      </style>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

export default function DroneMarker() {
  const dronePosition = useMapStore((s) => s.dronePosition);

  const icon = useMemo(
    () => createDroneIcon(dronePosition?.heading ?? 0),
    [dronePosition?.heading]
  );

  if (!dronePosition) return null;

  return (
    <Marker
      position={[dronePosition.lat, dronePosition.lng]}
      icon={icon}
    />
  );
}
