import { Rectangle, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';

const SECTOR_NAMES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];
const SECTOR_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981'];

function computeSectors(center) {
  const [lat, lng] = center;
  const SPAN = 0.012;

  return [
    { name: SECTOR_NAMES[0], bounds: [[lat, lng - SPAN], [lat + SPAN, lng]], color: SECTOR_COLORS[0] },
    { name: SECTOR_NAMES[1], bounds: [[lat, lng], [lat + SPAN, lng + SPAN]], color: SECTOR_COLORS[1] },
    { name: SECTOR_NAMES[2], bounds: [[lat - SPAN, lng - SPAN], [lat, lng]], color: SECTOR_COLORS[2] },
    { name: SECTOR_NAMES[3], bounds: [[lat - SPAN, lng], [lat, lng + SPAN]], color: SECTOR_COLORS[3] },
  ];
}

function sectorLabelIcon(name, color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        font-family:var(--font-mono); font-size:10px; font-weight:700;
        letter-spacing:0.2em; color:${color}; opacity:0.25;
        pointer-events:none; text-align:center;
      ">${name}</div>
    `,
    iconSize: [80, 20],
    iconAnchor: [40, 10],
  });
}

export default function SectorGrid() {
  const center = useMapStore((s) => s.center);
  const sectors = computeSectors(center);

  return (
    <>
      {sectors.map((sector) => (
        <span key={sector.name}>
          <Rectangle
            bounds={sector.bounds}
            pathOptions={{
              color: sector.color,
              fillColor: sector.color,
              fillOpacity: 0.015,
              weight: 0.5,
              opacity: 0.15,
              dashArray: '8 6',
            }}
          />
          <Marker
            position={[
              (sector.bounds[0][0] + sector.bounds[1][0]) / 2,
              (sector.bounds[0][1] + sector.bounds[1][1]) / 2,
            ]}
            icon={sectorLabelIcon(sector.name, sector.color)}
            interactive={false}
          />
        </span>
      ))}
    </>
  );
}
