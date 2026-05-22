import { useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useIntelStore } from '../stores/intelStore';
import { useMapStore } from '../stores/mapStore';

export function useEntityNavigation() {
  const setActiveView = useUIStore((s) => s.setActiveView);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const flyTo = useMapStore((s) => s.flyTo);

  const flyToEntity = useCallback((entity) => {
    selectEntity(entity.id);
    if (entity.coordinates) {
      flyTo(entity.coordinates, 16);
      setActiveView('map');
    }
  }, [selectEntity, flyTo, setActiveView]);

  const flyToCoordinates = useCallback((coordinates) => {
    if (coordinates) {
      flyTo(coordinates, 16);
      setActiveView('map');
    }
  }, [flyTo, setActiveView]);

  const showEntityDetail = useCallback((entityId) => {
    selectEntity(entityId);
    setActiveView('intel');
  }, [selectEntity, setActiveView]);

  return { flyToEntity, flyToCoordinates, showEntityDetail };
}
