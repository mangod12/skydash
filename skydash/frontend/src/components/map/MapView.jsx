import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import DroneMarker from './DroneMarker';
import MapHUD from './MapHUD';
import MapControls from './MapControls';
import CompassRose from './CompassRose';
import CoordinateDisplay from './CoordinateDisplay';
import MeasureTool, { MeasureOverlay } from './MeasureTool';
import GeofenceOverlay from './GeofenceOverlay';
import EntityMarkers from './EntityMarkers';
import FleetMarkers from './FleetMarkers';
import TimelineSlider from './TimelineSlider';
import AdsbLayer from './AdsbLayer';
import HeatmapLayer from './HeatmapLayer';
import GeofenceDraw from './GeofenceDraw';
import GeofenceManager from './GeofenceManager';
import SpatialSearchPanel, { SpatialSearchMapHandler, SpatialSearchOverlay } from './SpatialSearch';
import MapAnnotations from './MapAnnotations';
import ContextMenu, { useContextMenu } from '../common/ContextMenu';
import useMapContextMenu from '../../hooks/useMapContextMenu';
import useEntityContextMenu from '../../hooks/useEntityContextMenu';
import 'leaflet/dist/leaflet.css';

function MapContextHandler({ onContextMenu }) {
  useMapEvents({ contextmenu: onContextMenu });
  return null;
}

export const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
    maxNativeZoom: 20,
  },
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    maxZoom: 20,
    maxNativeZoom: 20,
  },
};

function MapRefBridge({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

function FlyToHandler() {
  const map = useMap();
  const flyToTarget = useMapStore((s) => s.flyToTarget);

  useEffect(() => {
    if (flyToTarget) {
      map.flyTo(flyToTarget.center, flyToTarget.zoom, { duration: 1.2 });
    }
  }, [flyToTarget, map]);

  return null;
}

function DroneTracker() {
  const map = useMap();
  const dronePosition = useMapStore((s) => s.dronePosition);
  const hasFlown = useRef(false);

  useEffect(() => {
    if (dronePosition && !hasFlown.current) {
      map.flyTo([37.7755, -122.4180], 14, { duration: 2 });
      hasFlown.current = true;
    }
  }, [dronePosition, map]);

  return null;
}

function GridOverlay() {
  const layers = useMapStore((s) => s.layers);
  if (!layers.grid) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5] opacity-[0.06]"
      style={{
        backgroundImage: 'linear-gradient(to right, #71717a 1px, transparent 1px), linear-gradient(to bottom, #71717a 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}
    />
  );
}

export default function MapView() {
  const { center, zoom, flightPath, layers, dronePosition, drawingGeofence, geofenceMode, stopDrawGeofence } = useMapStore();
  const data = useTelemetryStore((s) => s.data);
  const mapRef = useRef(null);

  // Context menu
  const { menu, show, hide } = useContextMenu();
  const entityMenu = useEntityContextMenu(show);

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

  // Flight path polyline positions
  const pathPoints = layers.flightPath
    ? flightPath.map((p) => [p.lat, p.lng])
    : [];

  const tileConfig = layers.satellite ? TILE_LAYERS.satellite : TILE_LAYERS.dark;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl map-container">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full z-0"
        zoomControl={false}
        attributionControl={false}
        style={{ background: '#09090b' }}
      >
        <MapRefBridge mapRef={mapRef} />
        <FlyToHandler />
        <DroneTracker />
        <MapContextHandler onContextMenu={openMapMenu} />

        <TileLayer
          url={tileConfig.url}
          maxZoom={tileConfig.maxZoom}
          maxNativeZoom={tileConfig.maxNativeZoom}
        />

        {/* Flight path trail — glowing dual-line */}
        {pathPoints.length > 1 && (
          <>
            <Polyline
              positions={pathPoints}
              pathOptions={{
                color: '#6366f1',
                weight: 6,
                opacity: 0.15,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={pathPoints}
              pathOptions={{
                color: '#818cf8',
                weight: 2,
                opacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>

        )}

        {/* Drone marker */}
        <DroneMarker />

        {/* Geofences */}
        {layers.geofences && <GeofenceOverlay />}

        {/* Intel entity markers */}
        {layers.entities && <EntityMarkers onEntityContextMenu={entityMenu} />}

        {/* Fleet secondary drones */}
        {layers.fleet && <FleetMarkers />}

        {/* Activity heatmap layer */}
        <HeatmapLayer visible={layers.heatmap} />

        {/* ADS-B aircraft layer */}
        <AdsbLayer />

        {/* Geofence drawing tool */}
        <GeofenceDraw
          active={drawingGeofence}
          mode={geofenceMode}
          onComplete={stopDrawGeofence}
        />

        {/* Measure tool (inside map for click events) */}
        <MeasureTool
          active={measuring}
          points={measurePoints}
          onAddPoint={handleAddMeasurePoint}
        />

        {/* Map annotations (text, pins, arrows, circles) */}
        <MapAnnotations />

        {/* Spatial search map handler + circle overlay */}
        <SpatialSearchMapHandler
          active={spatialSearch}
          onSetCenter={setSearchCenter}
        />
        <SpatialSearchOverlay
          center={searchCenter}
          radius={searchRadius}
          highlightedId={highlightedEntityId}
        />
      </MapContainer>

      {/* Grid overlay */}
      <GridOverlay />

      {/* HUD overlay */}
      <MapHUD data={data} />

      {/* Compass */}
      <CompassRose />

      {/* Controls */}
      <MapControls
        mapRef={mapRef}
        onMeasureToggle={handleMeasureToggle}
        measuring={measuring}
        onSpatialSearchToggle={handleSpatialSearchToggle}
        spatialSearch={spatialSearch}
      />

      {/* Geofence zone manager panel */}
      <GeofenceManager />

      {/* Measure distance display */}
      <MeasureOverlay active={measuring} points={measurePoints} />

      {/* Timeline playback slider */}
      <TimelineSlider />

      {/* Spatial search results panel */}
      <SpatialSearchPanel
        active={spatialSearch}
        center={searchCenter}
        radius={searchRadius}
        onRadiusChange={setSearchRadius}
        onClose={handleSpatialSearchClose}
        onHighlight={setHighlightedEntityId}
      />

      {/* Coordinate display */}
      <CoordinateDisplay
        lat={dronePosition?.lat}
        lng={dronePosition?.lng}
      />

      {/* Context menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={hide} />}
    </div>
  );
}
