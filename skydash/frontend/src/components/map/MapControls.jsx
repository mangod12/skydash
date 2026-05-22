import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Minus, Layers, Locate, Ruler,
  Camera, Maximize2, Circle, Pentagon, Search,
  Type, MapPin, MoveRight,
} from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { toast } from '../common/Toast';

const LAYER_LIST = [
  { key: 'flightPath', label: 'Flight Path' },
  { key: 'entities', label: 'Entity Markers' },
  { key: 'fleet', label: 'Fleet Markers' },
  { key: 'heatmap', label: 'Activity Heatmap' },
  { key: 'adsb', label: 'ADS-B Aircraft' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'grid', label: 'Grid Overlay' },
  { key: 'satellite', label: 'Satellite Tiles' },
];

function ToggleSwitch({ on, onChange, label }) {
  return (
    <button onClick={onChange} className="flex items-center justify-between w-full py-1.5 group">
      <span className="text-[11px] text-zinc-300 group-hover:text-zinc-100 transition-colors">
        {label}
      </span>
      <div className={clsx(
        'w-8 h-4 rounded-full relative transition-colors',
        on ? 'bg-indigo-500' : 'bg-zinc-700',
      )}>
        <div className={clsx(
          'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
          on ? 'left-[18px]' : 'left-0.5',
        )} />
      </div>
    </button>
  );
}

function ControlButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150',
        'border border-white/[0.06]',
        active
          ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
          : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80',
        'backdrop-blur-sm',
      )}
    >
      <Icon size={16} strokeWidth={1.5} />
    </button>
  );
}

function LayerPanel({ layers, toggleLayer, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-14 top-[108px] z-20 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[200px]"
    >
      <div className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
        MAP LAYERS
      </div>
      <div className="space-y-0.5">
        {LAYER_LIST.map((layer) => (
          <ToggleSwitch
            key={layer.key}
            on={!!layers[layer.key]}
            onChange={() => toggleLayer(layer.key)}
            label={layer.label}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function MapControls({ mapRef, onMeasureToggle, measuring, onSpatialSearchToggle, spatialSearch }) {
  const [showLayers, setShowLayers] = useState(false);
  const { layers, toggleLayer, dronePosition, drawingGeofence, startDrawGeofence, stopDrawGeofence, annotationMode, setAnnotationMode } = useMapStore();

  const handleClosePanel = useCallback(() => setShowLayers(false), []);

  const handleZoomIn = () => mapRef?.current?.zoomIn();
  const handleZoomOut = () => mapRef?.current?.zoomOut();

  const handleFlyToDrone = () => {
    if (dronePosition && mapRef?.current) {
      mapRef.current.flyTo([dronePosition.lat, dronePosition.lng], 17, { duration: 1 });
    }
  };

  const handleScreenshot = () => {
    const mapEl = document.querySelector('.map-container');
    if (!mapEl) return;
    const canvas = mapEl.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `skydash-map-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('Map screenshot saved', 'success');
    } else {
      toast('Screenshot requires canvas renderer', 'warning');
    }
  };

  return (
    <>
      {/* Right side controls */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
        <ControlButton icon={Plus} label="Zoom In" onClick={handleZoomIn} />
        <ControlButton icon={Minus} label="Zoom Out" onClick={handleZoomOut} />

        <div className="h-px bg-white/[0.06] my-1" />

        <ControlButton icon={Locate} label="Fly to Drone" onClick={handleFlyToDrone} />
        <ControlButton
          icon={Layers}
          label="Layers"
          active={showLayers}
          onClick={() => setShowLayers((v) => !v)}
        />
        <ControlButton
          icon={Ruler}
          label="Measure"
          active={measuring}
          onClick={onMeasureToggle}
        />
        <ControlButton
          icon={Search}
          label="Spatial Search"
          active={spatialSearch}
          onClick={onSpatialSearchToggle}
        />

        <div className="h-px bg-white/[0.06] my-1" />

        <ControlButton
          icon={Type}
          label="Text Label"
          active={annotationMode === 'text'}
          onClick={() => setAnnotationMode('text')}
        />
        <ControlButton
          icon={MapPin}
          label="Marker Pin"
          active={annotationMode === 'pin'}
          onClick={() => setAnnotationMode('pin')}
        />
        <ControlButton
          icon={MoveRight}
          label="Arrow"
          active={annotationMode === 'arrow'}
          onClick={() => setAnnotationMode('arrow')}
        />

        <div className="h-px bg-white/[0.06] my-1" />

        <ControlButton
          icon={Circle}
          label="Geofence Circle"
          active={drawingGeofence}
          onClick={() => drawingGeofence ? stopDrawGeofence() : startDrawGeofence('circle')}
        />
        <ControlButton
          icon={Pentagon}
          label="Geofence Polygon"
          active={drawingGeofence}
          onClick={() => drawingGeofence ? stopDrawGeofence() : startDrawGeofence('polygon')}
        />

        <div className="h-px bg-white/[0.06] my-1" />

        <ControlButton icon={Camera} label="Screenshot" onClick={handleScreenshot} />
        <ControlButton icon={Maximize2} label="Fullscreen" onClick={() => {
          document.querySelector('.map-container')?.requestFullscreen?.();
        }} />
      </div>

      {/* Layer panel */}
      <AnimatePresence>
        {showLayers && (
          <LayerPanel
            layers={layers}
            toggleLayer={toggleLayer}
            onClose={handleClosePanel}
          />
        )}
      </AnimatePresence>
    </>
  );
}
