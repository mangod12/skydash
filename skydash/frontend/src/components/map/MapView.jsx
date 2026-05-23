import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import MapHUD from './MapHUD';
import MapControls from './MapControls';
import CompassRose from './CompassRose';
import CoordinateDisplay from './CoordinateDisplay';
import { MeasureOverlay } from './MeasureTool';
import GeofenceManager from './GeofenceManager';
import TimelineSlider from './TimelineSlider';
import PlaybackController from './PlaybackController';
import SpatialSearchPanel from './SpatialSearch';
import BearingPanel from './BearingPanel';
import ContextMenu from '../common/ContextMenu';
import MapOverlays from './MapOverlays';
import DeckGlOverlay from './DeckGlOverlay';
import ProximityWarning from './ProximityWarning';
import { useDeckLayers } from './deckLayers';
import { useMapInteractions } from './MapInteractions';
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

  const interactions = useMapInteractions();
  const deckLayers = useDeckLayers();

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
        <MapContextHandler onContextMenu={interactions.openMapMenu} />

        <TileLayer
          url={tileConfig.url}
          maxZoom={tileConfig.maxZoom}
          maxNativeZoom={tileConfig.maxNativeZoom}
        />

        <DeckGlOverlay layers={deckLayers} />

        <MapOverlays
          layers={layers}
          drawingGeofence={drawingGeofence}
          geofenceMode={geofenceMode}
          stopDrawGeofence={stopDrawGeofence}
          entityMenu={interactions.entityMenu}
          measuring={interactions.measuring}
          measurePoints={interactions.measurePoints}
          onAddMeasurePoint={interactions.handleAddMeasurePoint}
          bearingMode={interactions.bearingMode}
          bearingPending={interactions.bearingPending}
          onSetBearingPending={interactions.setBearingPending}
          spatialSearch={interactions.spatialSearch}
          onSetSearchCenter={interactions.setSearchCenter}
          searchCenter={interactions.searchCenter}
          searchRadius={interactions.searchRadius}
          highlightedEntityId={interactions.highlightedEntityId}
          pathPoints={pathPoints}
        />
      </MapContainer>

      <GridOverlay />
      <ProximityWarning />
      <MapHUD data={data} />
      <CompassRose />
      <BearingPanel active={interactions.bearingMode} />

      <MapControls
        mapRef={mapRef}
        onMeasureToggle={interactions.handleMeasureToggle}
        measuring={interactions.measuring}
        onSpatialSearchToggle={interactions.handleSpatialSearchToggle}
        spatialSearch={interactions.spatialSearch}
        onBearingToggle={interactions.handleBearingToggle}
        bearingActive={interactions.bearingMode}
      />

      <GeofenceManager />
      <MeasureOverlay active={interactions.measuring} points={interactions.measurePoints} />
      <TimelineSlider />
      <PlaybackController />

      <SpatialSearchPanel
        active={interactions.spatialSearch}
        center={interactions.searchCenter}
        radius={interactions.searchRadius}
        onRadiusChange={interactions.setSearchRadius}
        onClose={interactions.handleSpatialSearchClose}
        onHighlight={interactions.setHighlightedEntityId}
      />

      <CoordinateDisplay
        lat={dronePosition?.lat}
        lng={dronePosition?.lng}
      />

      {interactions.menu && <ContextMenu x={interactions.menu.x} y={interactions.menu.y} items={interactions.menu.items} onClose={interactions.hide} />}
    </div>
  );
}
