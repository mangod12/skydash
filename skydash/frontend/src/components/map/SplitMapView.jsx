import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Link2, Link2Off, X } from 'lucide-react';
import MapView from './MapView';
import ComparisonMap from './ComparisonMap';

function useSyncLeft(syncEnabled) {
  const [center, setCenter] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    const poll = setInterval(() => {
      if (!syncEnabled) return;
      const el = document.querySelector('.split-left-map .leaflet-container');
      const map = el?._leaflet_map;
      if (!map) return;
      if (!el.__splitSync) {
        el.__splitSync = true;
        map.on('moveend', () => {
          setCenter({ lat: map.getCenter().lat, lng: map.getCenter().lng });
          setZoom(map.getZoom());
        });
        setCenter({ lat: map.getCenter().lat, lng: map.getCenter().lng });
        setZoom(map.getZoom());
      }
    }, 200);
    return () => clearInterval(poll);
  }, [syncEnabled]);

  const resync = useCallback(() => {
    const el = document.querySelector('.split-left-map .leaflet-container');
    const map = el?._leaflet_map;
    if (map) {
      setCenter({ lat: map.getCenter().lat, lng: map.getCenter().lng });
      setZoom(map.getZoom());
    }
  }, []);

  return { center, zoom, resync };
}

export default function SplitMapView({ onClose }) {
  const [syncEnabled, setSyncEnabled] = useState(true);
  const rightRef = useRef(null);
  const { center, zoom, resync } = useSyncLeft(syncEnabled);

  const toggleSync = useCallback(() => {
    setSyncEnabled((prev) => {
      if (!prev) resync();
      return !prev;
    });
  }, [resync]);

  return (
    <motion.div className="h-full w-full flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      {/* Left: Live View */}
      <div className="split-left-map flex-1 min-w-0 relative">
        <MapView />
        <div className="absolute top-3 left-3 z-30">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-500 bg-zinc-950/70 backdrop-blur-sm px-2 py-1 rounded border border-white/[0.06]">LIVE VIEW</span>
        </div>
      </div>

      <div className="w-px bg-white/[0.06] flex-shrink-0" />

      {/* Right: Comparison View */}
      <motion.div className="flex-1 min-w-0 relative" initial={{ width: 0, opacity: 0 }} animate={{ width: '50%', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
        <ComparisonMap ref={rightRef} syncEnabled={syncEnabled} syncCenter={center} syncZoom={zoom} />
        <div className="absolute top-3 left-12 z-30">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-500 bg-zinc-950/70 backdrop-blur-sm px-2 py-1 rounded border border-white/[0.06]">COMPARISON</span>
        </div>
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
          <button
            onClick={toggleSync}
            title={syncEnabled ? 'Disable sync' : 'Enable sync'}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider transition-all border backdrop-blur-sm',
              syncEnabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-zinc-900/80 text-zinc-500 border-white/[0.06] hover:text-zinc-300',
            )}
          >
            {syncEnabled ? <Link2 size={12} /> : <Link2Off size={12} />}
            SYNC
          </button>
          <button
            onClick={onClose}
            title="Close split view"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] backdrop-blur-sm transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
