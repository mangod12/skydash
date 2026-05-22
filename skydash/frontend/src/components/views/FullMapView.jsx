import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Columns } from 'lucide-react';
import MapView from '../map/MapView';
import SplitMapView from '../map/SplitMapView';
import AlertBar from '../telemetry/AlertBar';
import BookmarkBar from '../common/BookmarkBar';
import { useMapStore } from '../../stores/mapStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

export default function FullMapView() {
  const [splitView, setSplitView] = useState(false);

  const handleBookmark = useCallback((action, payload) => {
    const map = useMapStore.getState();
    if (action === 'save') {
      useBookmarkStore.getState().addBookmark({
        name: payload,
        type: 'mapview',
        config: { center: map.center, zoom: map.zoom, layers: { ...map.layers } },
      });
    } else if (action === 'apply') {
      const { config } = payload;
      map.flyTo(config.center, config.zoom);
      if (config.layers) {
        Object.entries(config.layers).forEach(([layer, on]) => {
          if (map.layers[layer] !== on) map.toggleLayer(layer);
        });
      }
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      <AlertBar />
      <div className="flex items-center gap-2 px-3">
        <div className="flex-1">
          <BookmarkBar type="mapview" onApply={handleBookmark} />
        </div>
        <button
          onClick={() => setSplitView((v) => !v)}
          title={splitView ? 'Close split view' : 'Split view'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider transition-all border backdrop-blur-sm ${
            splitView
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
              : 'bg-zinc-900/80 text-zinc-400 border-white/[0.06] hover:text-zinc-200'
          }`}
        >
          <Columns size={13} />
          SPLIT
        </button>
      </div>
      <div className="flex-1 min-h-0 p-3">
        <AnimatePresence mode="wait">
          {splitView ? (
            <SplitMapView key="split" onClose={() => setSplitView(false)} />
          ) : (
            <MapView key="single" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
