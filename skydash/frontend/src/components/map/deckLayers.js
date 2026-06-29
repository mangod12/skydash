import { useMemo } from 'react';
import { ScatterplotLayer, ArcLayer, PathLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMapStore } from '../../stores/mapStore';
import { COLORS, THREAT_COLORS } from '../../utils/designTokens';

function hexToRgba(hex, alpha = 255) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

const THREAT_RGBA = {
  none: hexToRgba(THREAT_COLORS.none, 120),
  low: hexToRgba(THREAT_COLORS.low, 160),
  medium: hexToRgba(THREAT_COLORS.medium, 180),
  high: hexToRgba(THREAT_COLORS.high, 210),
  critical: hexToRgba(THREAT_COLORS.critical, 240),
};

const RELATIONSHIP_RGBA = {
  located_at: hexToRgba(COLORS.data, 140),
  associated_with: hexToRgba(COLORS.intel, 140),
  traveled_to: hexToRgba(COLORS.warning, 140),
  communicates_with: hexToRgba(COLORS.critical, 140),
  owns: hexToRgba(COLORS.healthy, 140),
};

const THREAT_RADII = { none: 60, low: 80, medium: 100, high: 130, critical: 160 };

const HEX_COLOR_RANGE = [
  [6, 182, 212, 100],
  [16, 185, 129, 130],
  [245, 158, 11, 150],
  [239, 68, 68, 170],
  [220, 38, 38, 190],
  [153, 27, 27, 210],
];

function deterministicUnit(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function seedFromId(id) {
  return String(id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

// --- Individual layer hooks ---

function useEntityScatterLayer(visible) {
  const entities = useIntelStore((s) => s.entities);

  return useMemo(() => {
    if (!visible) return null;
    const data = entities.filter((e) => e.coordinates);

    return new ScatterplotLayer({
      id: 'deck-entity-scatter',
      data,
      getPosition: (d) => [d.coordinates[1], d.coordinates[0]],
      getRadius: (d) => THREAT_RADII[d.threatLevel] || 60,
      getFillColor: (d) => THREAT_RGBA[d.threatLevel] || THREAT_RGBA.none,
      getLineColor: (d) => {
        const c = THREAT_RGBA[d.threatLevel] || THREAT_RGBA.none;
        return [c[0], c[1], c[2], 255];
      },
      lineWidthMinPixels: 1,
      radiusMinPixels: 6,
      radiusMaxPixels: 24,
      stroked: true,
      filled: true,
      opacity: 0.6,
      radiusUnits: 'meters',
      parameters: { depthTest: false },
    });
  }, [visible, entities]);
}

function useRelationshipArcLayer(visible) {
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);

  return useMemo(() => {
    if (!visible) return null;

    const entityMap = new Map(
      entities.filter((e) => e.coordinates).map((e) => [e.id, e]),
    );

    const data = relationships
      .map((r) => {
        const from = entityMap.get(r.from);
        const to = entityMap.get(r.to);
        if (!from || !to) return null;
        return { ...r, fromCoords: from.coordinates, toCoords: to.coordinates };
      })
      .filter(Boolean);

    return new ArcLayer({
      id: 'deck-relationship-arcs',
      data,
      getSourcePosition: (d) => [d.fromCoords[1], d.fromCoords[0]],
      getTargetPosition: (d) => [d.toCoords[1], d.toCoords[0]],
      getSourceColor: (d) => RELATIONSHIP_RGBA[d.type] || RELATIONSHIP_RGBA.associated_with,
      getTargetColor: (d) => RELATIONSHIP_RGBA[d.type] || RELATIONSHIP_RGBA.associated_with,
      getWidth: (d) => Math.max(1, d.confidence / 20),
      widthMinPixels: 1,
      widthMaxPixels: 5,
      greatCircle: false,
      getHeight: 0.4,
      opacity: 0.7,
      parameters: { depthTest: false },
    });
  }, [visible, entities, relationships]);
}

function useFlightTrailLayer(visible) {
  const flightPath = useMapStore((s) => s.flightPath);
  const fleet = useTelemetryStore((s) => s.fleet);
  const activeDroneId = useTelemetryStore((s) => s.activeDroneId);

  return useMemo(() => {
    if (!visible || flightPath.length < 2) return null;

    const paths = [
      {
        id: 'primary',
        path: flightPath.map((p) => [p.lng, p.lat]),
        color: hexToRgba(COLORS.brand, 180),
      },
    ];

    // Secondary drones — use their current position to show a short marker trail
    fleet.forEach((drone) => {
      if (!drone.gps || drone.drone_id === activeDroneId) return;
      const { latitude, longitude } = drone.gps;
      // Single-point indicator for fleet drones
      paths.push({
        id: drone.drone_id,
        path: [
          [longitude - 0.0002, latitude - 0.0002],
          [longitude, latitude],
        ],
        color: hexToRgba(COLORS.dataLight, 140),
      });
    });

    return new PathLayer({
      id: 'deck-flight-trails',
      data: paths,
      getPath: (d) => d.path,
      getColor: (d) => d.color,
      getWidth: 4,
      widthMinPixels: 2,
      widthMaxPixels: 8,
      capRounded: true,
      jointRounded: true,
      opacity: 0.7,
      parameters: { depthTest: false },
    });
  }, [visible, flightPath, fleet, activeDroneId]);
}

function useActivityHexLayer(visible) {
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);

  return useMemo(() => {
    if (!visible) return null;

    const threatWeight = { none: 1, low: 2, medium: 3, high: 4, critical: 5 };
    const eventCounts = {};
    events.forEach((e) => {
      if (e.entityId) eventCounts[e.entityId] = (eventCounts[e.entityId] || 0) + 1;
    });

    const data = [];
    entities.filter((e) => e.coordinates).forEach((entity) => {
      const [lat, lng] = entity.coordinates;
      const w = threatWeight[entity.threatLevel] || 1;
      const evtBoost = Math.min((eventCounts[entity.id] || 0), 5);

      // Core point
      data.push({ position: [lng, lat], weight: w + evtBoost });

      // Scatter points for density spread
      const count = w * 2 + evtBoost;
      const baseSeed = seedFromId(entity.id);
      for (let i = 0; i < count; i++) {
        const seed = baseSeed + i * 31;
        const angle = (Math.PI * 2 * i) / count + deterministicUnit(seed) * 0.4;
        const dist = 0.0008 + deterministicUnit(seed + 17) * 0.0015;
        data.push({
          position: [lng + Math.sin(angle) * dist, lat + Math.cos(angle) * dist],
          weight: Math.ceil(w * 0.5),
        });
      }
    });

    return new HexagonLayer({
      id: 'deck-activity-hex',
      data,
      getPosition: (d) => d.position,
      getColorWeight: (d) => d.weight,
      colorAggregation: 'SUM',
      radius: 80,
      coverage: 0.85,
      extruded: false,
      colorRange: HEX_COLOR_RANGE,
      opacity: 0.35,
      parameters: { depthTest: false },
    });
  }, [visible, entities, events]);
}

// --- Combined hook ---

export function useDeckLayers() {
  const layers = useMapStore((s) => s.layers);

  const scatter = useEntityScatterLayer(layers.deckScatter);
  const arcs = useRelationshipArcLayer(layers.deckArcs);
  const trails = useFlightTrailLayer(layers.deckTrails);
  const hex = useActivityHexLayer(layers.deckHex);

  return useMemo(
    () => [scatter, arcs, trails, hex].filter(Boolean),
    [scatter, arcs, trails, hex],
  );
}
