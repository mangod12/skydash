import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { clsx } from 'clsx';
import { useMapStore } from '../../stores/mapStore';
import EntityMarkers from './EntityMarkers';
import FleetMarkers from './FleetMarkers';
import DroneMarker from './DroneMarker';
import { TILE_LAYERS } from './MapView';
import 'leaflet/dist/leaflet.css';

const PILLS = [
  { key: 'satellite', label: 'SAT' },
  { key: 'entities', label: 'ENT' },
  { key: 'fleet', label: 'FLEET' },
];

function MapBridge({ mapRef, onMoveEnd }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  useMapEvents({ moveend: () => onMoveEnd?.(map.getCenter(), map.getZoom()) });
  return null;
}

function SyncReceiver({ center, zoom }) {
  const map = useMap();
  const last = useRef(null);
  useEffect(() => {
    if (!center) return;
    const key = `${center.lat},${center.lng},${zoom}`;
    if (key === last.current) return;
    last.current = key;
    map.setView(center, zoom, { animate: false });
  }, [center, zoom, map]);
  return null;
}

const ComparisonMap = forwardRef(function ComparisonMap({ syncEnabled, syncCenter, syncZoom, onMoveEnd }, ref) {
  const { center, zoom } = useMapStore();
  const mapRef = useRef(null);
  const [layers, setLayers] = useState({ satellite: true, entities: true, fleet: true });

  useEffect(() => { if (ref) ref.current = mapRef.current; });

  const toggle = useCallback((k) => setLayers((p) => ({ ...p, [k]: !p[k] })), []);
  const tile = layers.satellite ? TILE_LAYERS.satellite : TILE_LAYERS.dark;

  return (
    <div className="relative h-full w-full overflow-hidden opacity-[0.95]">
      <MapContainer center={center} zoom={zoom} className="h-full w-full z-0" zoomControl={false} attributionControl={false} style={{ background: '#09090b' }}>
        <MapBridge mapRef={mapRef} onMoveEnd={onMoveEnd} />
        {syncEnabled && <SyncReceiver center={syncCenter} zoom={syncZoom} />}
        <TileLayer url={tile.url} maxZoom={tile.maxZoom} maxNativeZoom={tile.maxNativeZoom} />
        <DroneMarker />
        {layers.entities && <EntityMarkers />}
        {layers.fleet && <FleetMarkers />}
      </MapContainer>

      {/* Sync indicator */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
        <div className={clsx('w-2 h-2 rounded-full', syncEnabled ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-zinc-600')} />
        <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-500">{syncEnabled ? 'SYNCED' : 'INDEPENDENT'}</span>
      </div>

      {/* Layer toggle pills */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1">
        {PILLS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={clsx(
              'px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider transition-all border backdrop-blur-sm',
              layers[key] ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-zinc-900/80 text-zinc-500 border-white/[0.06] hover:text-zinc-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
});

export default ComparisonMap;
