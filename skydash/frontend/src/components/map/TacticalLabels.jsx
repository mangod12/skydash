import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';

const TYPE_ABBR = {
  person: 'PER', vehicle: 'VEH', building: 'FAC',
  device: 'SIG', event: 'EVT',
};

const THREAT_BADGE = {
  none: { bg: '#27272a', text: '#a1a1aa' },
  low: { bg: '#064e3b', text: '#6ee7b7' },
  medium: { bg: '#78350f', text: '#fcd34d' },
  high: { bg: '#7f1d1d', text: '#fca5a5' },
  critical: { bg: '#7f1d1d', text: '#fca5a5' },
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function createLabelIcon(entity, distStr) {
  const type = TYPE_ABBR[entity.type] || 'UNK';
  const badge = THREAT_BADGE[entity.threatLevel] || THREAT_BADGE.none;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex; align-items:center; gap:4px; padding:2px 6px;
        background:rgba(9,9,11,0.85); backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,0.06); border-radius:4px;
        font-family:var(--font-mono); font-size:9px; white-space:nowrap;
        pointer-events:none;
      ">
        <span style="
          padding:1px 3px; border-radius:2px; font-size:7px; font-weight:700;
          letter-spacing:0.05em; background:${badge.bg}; color:${badge.text};
        ">${type}</span>
        <span style="color:#d4d4d8; font-weight:600;">${entity.name.length > 14 ? entity.name.slice(0, 14) + '\u2026' : entity.name}</span>
        <span style="color:#52525b; font-variant-numeric:tabular-nums;">${distStr}</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [-14, -8],
  });
}

export default function TacticalLabels() {
  const entities = useIntelStore((s) => s.entities);
  const dronePos = useMapStore((s) => s.dronePosition);

  const labeled = entities.filter((e) => e.coordinates);

  return (
    <>
      {labeled.map((entity) => {
        const [lat, lng] = entity.coordinates;
        const dist = dronePos
          ? formatDist(haversineKm(dronePos.lat, dronePos.lng, lat, lng))
          : '--';

        return (
          <Marker
            key={`tl-${entity.id}`}
            position={[lat, lng]}
            icon={createLabelIcon(entity, dist)}
            interactive={false}
          />
        );
      })}
    </>
  );
}
