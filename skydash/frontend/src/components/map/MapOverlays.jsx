import { Polyline, CircleMarker, ScaleControl } from 'react-leaflet';
import DroneMarker from './DroneMarker';
import GeofenceOverlay from './GeofenceOverlay';
import ClusterMarkers from './ClusterMarkers';
import FleetMarkers from './FleetMarkers';
import AdsbLayer from './AdsbLayer';
import HeatmapLayer from './HeatmapLayer';
import GeofenceDraw from './GeofenceDraw';
import MeasureTool from './MeasureTool';
import BearingTool from './BearingTool';
import MapAnnotations from './MapAnnotations';
import PlaybackMarkers from './PlaybackMarkers';
import ThreatZones from './ThreatZones';
import DroneFootprint from './DroneFootprint';
import TacticalLabels from './TacticalLabels';
import SectorGrid from './SectorGrid';
import { SpatialSearchMapHandler, SpatialSearchOverlay } from './SpatialSearch';

/**
 * Flight path trail — glowing dual-line + head marker.
 */
export function FlightPath({ pathPoints }) {
  if (pathPoints.length <= 1) return null;

  return (
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
          dashArray: '8 12',
          dashOffset: '0',
          className: 'animate-trail',
        }}
      />
      {pathPoints.length > 2 && (
        <CircleMarker
          center={pathPoints[pathPoints.length - 1]}
          radius={5}
          pathOptions={{
            color: '#818cf8',
            fillColor: '#6366f1',
            fillOpacity: 0.9,
            weight: 2,
            opacity: 0.8,
            className: 'animate-trail-head',
          }}
        />
      )}
    </>
  );
}

/**
 * All overlays rendered inside the MapContainer.
 */
export default function MapOverlays({
  layers,
  drawingGeofence,
  geofenceMode,
  stopDrawGeofence,
  entityMenu,
  measuring,
  measurePoints,
  onAddMeasurePoint,
  bearingMode,
  bearingPending,
  onSetBearingPending,
  spatialSearch,
  onSetSearchCenter,
  searchCenter,
  searchRadius,
  highlightedEntityId,
  pathPoints,
}) {
  return (
    <>
      <ScaleControl position="bottomright" imperial={false} />

      {/* Flight path trail */}
      <FlightPath pathPoints={pathPoints} />

      {/* Drone marker */}
      <DroneMarker />

      {/* Geofences */}
      {layers.geofences && <GeofenceOverlay />}

      {/* Intel entity markers — clustered at low zoom */}
      {layers.entities && <ClusterMarkers onEntityContextMenu={entityMenu} />}

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

      {/* Measure tool */}
      <MeasureTool
        active={measuring}
        points={measurePoints}
        onAddPoint={onAddMeasurePoint}
      />

      {/* Bearing tool */}
      <BearingTool
        active={bearingMode}
        pendingPoint={bearingPending}
        onSetPending={onSetBearingPending}
      />

      {/* Map annotations */}
      <MapAnnotations />

      {/* Tactical overlays */}
      {layers.threatZones && <ThreatZones />}
      {layers.droneFootprint && <DroneFootprint />}
      {layers.tacticalLabels && <TacticalLabels />}
      {layers.sectors && <SectorGrid />}

      {/* Playback ghost markers */}
      <PlaybackMarkers />

      {/* Spatial search map handler + circle overlay */}
      <SpatialSearchMapHandler
        active={spatialSearch}
        onSetCenter={onSetSearchCenter}
      />
      <SpatialSearchOverlay
        center={searchCenter}
        radius={searchRadius}
        highlightedId={highlightedEntityId}
      />
    </>
  );
}
