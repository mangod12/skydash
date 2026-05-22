import { useCallback } from 'react';
import MapView from '../map/MapView';
import AlertBar from '../telemetry/AlertBar';
import BookmarkBar from '../common/BookmarkBar';
import { useMapStore } from '../../stores/mapStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

export default function FullMapView() {
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
      <BookmarkBar type="mapview" onApply={handleBookmark} />
      <div className="flex-1 min-h-0 p-3">
        <MapView />
      </div>
    </div>
  );
}
