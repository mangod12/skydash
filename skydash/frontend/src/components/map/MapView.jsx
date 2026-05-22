import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
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
import GeofenceDraw from './GeofenceDraw';
import 'leaflet/dist/leaflet.css';

const TILE_LAYERS = {
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
        <DroneTracker />

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
        <GeofenceOverlay />

        {/* Intel entity markers */}
        <EntityMarkers />

        {/* Fleet secondary drones */}
        <FleetMarkers />

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
      />

      {/* Measure distance display */}
      <MeasureOverlay active={measuring} points={measurePoints} />

      {/* Timeline playback slider */}
      <TimelineSlider />

      {/* Coordinate display */}
      <CoordinateDisplay
        lat={dronePosition?.lat}
        lng={dronePosition?.lng}
      />
    </div>
  );
}
