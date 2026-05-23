import { useState, useCallback } from 'react';
import { useMapStore } from '../../stores/mapStore';
import useMapContextMenu from '../../hooks/useMapContextMenu';
import useEntityContextMenu from '../../hooks/useEntityContextMenu';
import { useContextMenu } from '../common/ContextMenu';

/**
 * Custom hook that bundles all MapView interaction state:
 * context menus, bearing mode, measure mode, spatial search.
 */
export function useMapInteractions() {
  // Context menu
  const { menu, show, hide } = useContextMenu();
  const entityMenu = useEntityContextMenu(show);

  // Bearing tool state
  const bearingMode = useMapStore((s) => s.bearingMode);
  const setBearingMode = useMapStore((s) => s.setBearingMode);
  const [bearingPending, setBearingPending] = useState(null);

  const handleBearingToggle = useCallback(() => {
    setBearingMode(!bearingMode);
    setBearingPending(null);
  }, [bearingMode, setBearingMode]);

  // Measure tool state
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

  const handleMeasureToggle = useCallback(() => {
    setMeasuring((prev) => {
      if (prev) setMeasurePoints([]);
      return !prev;
    });
  }, []);

  const handleAddMeasurePoint = useCallback((point) => {
    setMeasurePoints((prev) => [...prev, point]);
  }, []);

  // Spatial search state
  const [spatialSearch, setSpatialSearch] = useState(false);
  const [searchCenter, setSearchCenter] = useState(null);
  const [searchRadius, setSearchRadius] = useState(500);
  const [highlightedEntityId, setHighlightedEntityId] = useState(null);

  const handleSpatialSearchToggle = useCallback(() => {
    setSpatialSearch((prev) => {
      if (prev) {
        setSearchCenter(null);
        setHighlightedEntityId(null);
      }
      return !prev;
    });
  }, []);

  const handleSpatialSearchClose = useCallback(() => {
    setSpatialSearch(false);
    setSearchCenter(null);
    setHighlightedEntityId(null);
  }, []);

  const handleMeasureFrom = useCallback((point) => {
    setMeasuring(true);
    setMeasurePoints([point]);
  }, []);

  const handleSearchFromMenu = useCallback((point) => {
    setSpatialSearch(true);
    setSearchCenter(point);
  }, []);

  const openMapMenu = useMapContextMenu({
    show,
    onMeasureFrom: handleMeasureFrom,
    onSearchRadius: handleSearchFromMenu,
  });

  return {
    // Context menu
    menu,
    hide,
    openMapMenu,
    entityMenu,
    // Bearing
    bearingMode,
    bearingPending,
    setBearingPending,
    handleBearingToggle,
    // Measure
    measuring,
    measurePoints,
    handleMeasureToggle,
    handleAddMeasurePoint,
    // Spatial search
    spatialSearch,
    searchCenter,
    searchRadius,
    setSearchRadius,
    setSearchCenter,
    highlightedEntityId,
    setHighlightedEntityId,
    handleSpatialSearchToggle,
    handleSpatialSearchClose,
  };
}
