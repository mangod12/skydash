import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const THREAT_COLORS = {
  none: '#71717a',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

export default function EntityMiniMap({ coordinates, threatLevel }) {
  if (!coordinates) return null;

  const color = THREAT_COLORS[threatLevel] || '#22d3ee';

  return (
    <div className="h-[100px] rounded-lg overflow-hidden border border-white/[0.08]">
      <MapContainer
        center={coordinates}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ background: '#09090b' }}
      >
        <TileLayer url={TILE_URL} maxZoom={20} maxNativeZoom={20} />
        <CircleMarker
          center={coordinates}
          radius={6}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2,
            opacity: 1,
          }}
        />
      </MapContainer>
    </div>
  );
}
