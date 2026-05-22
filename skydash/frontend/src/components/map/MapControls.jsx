import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Plus, Minus, Layers, Locate, Ruler,
  Camera, Maximize2,
} from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { toast } from '../common/Toast';

const LAYER_OPTIONS = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'flightPath', label: 'Flight Path' },
  { id: 'grid', label: 'Grid Overlay' },
];

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

export default function MapControls({ mapRef, onMeasureToggle, measuring }) {
  const [showLayers, setShowLayers] = useState(false);
  const { layers, toggleLayer, dronePosition } = useMapStore();

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
    // Use the leaflet canvas if available, otherwise grab the container
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
          onClick={() => setShowLayers(!showLayers)}
        />
        <ControlButton
          icon={Ruler}
          label="Measure"
          active={measuring}
          onClick={onMeasureToggle}
        />

        <div className="h-px bg-white/[0.06] my-1" />

        <ControlButton icon={Camera} label="Screenshot" onClick={handleScreenshot} />
        <ControlButton icon={Maximize2} label="Fullscreen" onClick={() => {
          document.querySelector('.map-container')?.requestFullscreen?.();
        }} />
      </div>

      {/* Layer panel */}
      {showLayers && (
        <div className="absolute right-14 top-1/2 -translate-y-1/2 z-20 bg-zinc-900/90 backdrop-blur-md border border-white/[0.08] rounded-xl p-3 min-w-[160px]">
          <div className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
            MAP LAYERS
          </div>
          <div className="space-y-1">
            {LAYER_OPTIONS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors',
                  layers[layer.id]
                    ? 'text-indigo-400 bg-indigo-500/10'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
                )}
              >
                <div className={clsx(
                  'w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors',
                  layers[layer.id]
                    ? 'border-indigo-500 bg-indigo-500'
                    : 'border-zinc-600',
                )}>
                  {layers[layer.id] && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {layer.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
