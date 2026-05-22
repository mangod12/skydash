import { create } from 'zustand';

export const useMapStore = create((set) => ({
  center: [37.7755, -122.4180],
  zoom: 14,
  dronePosition: null,
  flightPath: [],
  layers: {
    satellite: false,
    grid: true,
    flightPath: true,
    adsb: true,
    heatmap: true,
    entities: true,
    fleet: true,
    geofences: true,
  },
  drawingGeofence: false,
  geofenceMode: 'circle',
  geofences: [
    { id: 'gf-alpha', name: 'Zone Alpha', type: 'circle', center: { lat: 37.7755, lng: -122.4180 }, radius: 500, color: '#6366f1', active: true, alertOnEntry: true, alertOnExit: false, createdAt: '2026-05-20T08:00:00Z' },
    { id: 'gf-bravo', name: 'Zone Bravo', type: 'circle', center: { lat: 37.7780, lng: -122.4150 }, radius: 300, color: '#f59e0b', active: true, alertOnEntry: true, alertOnExit: true, createdAt: '2026-05-20T09:30:00Z' },
  ],
  geofenceManagerOpen: false,

  // Bearing lines
  bearingLines: [],
  bearingMode: false,

  addBearingLine: (line) => set((s) => ({
    bearingLines: s.bearingLines.length >= 5
      ? s.bearingLines
      : [...s.bearingLines, { ...line, id: `brg-${Date.now()}` }],
  })),

  removeBearingLine: (id) => set((s) => ({
    bearingLines: s.bearingLines.filter((l) => l.id !== id),
  })),

  clearBearingLines: () => set({ bearingLines: [] }),

  setBearingMode: (active) => set({ bearingMode: active }),

  // Annotations
  annotations: [],
  annotationMode: null,

  addAnnotation: (annotation) => set((s) => ({
    annotations: [...s.annotations, { ...annotation, id: `ann-${Date.now()}`, createdAt: Date.now() }],
    annotationMode: annotation.type === 'pin' ? s.annotationMode : null,
  })),

  removeAnnotation: (id) => set((s) => ({
    annotations: s.annotations.filter((a) => a.id !== id),
  })),

  clearAnnotations: () => set({ annotations: [] }),

  setAnnotationMode: (mode) => set((s) => ({
    annotationMode: s.annotationMode === mode ? null : mode,
  })),

  // flyToTarget: { center, zoom, ts } — each call triggers a map.flyTo
  flyToTarget: null,

  flyTo: (center, zoom) => set({ flyToTarget: { center, zoom: zoom ?? 16, ts: Date.now() } }),

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),

  updateDronePosition: (lat, lng, alt, heading) => {
    set((s) => ({
      dronePosition: { lat, lng, alt, heading },
      flightPath: [...s.flightPath, { lat, lng, alt, time: Date.now() }].slice(-500),
    }));
  },

  toggleLayer: (layer) => set((s) => ({
    layers: { ...s.layers, [layer]: !s.layers[layer] },
  })),

  addGeofence: (geofence) => set((s) => ({
    geofences: [...s.geofences, geofence],
    drawingGeofence: false,
  })),

  startDrawGeofence: (mode) => set({ drawingGeofence: true, geofenceMode: mode || 'circle' }),
  stopDrawGeofence: () => set({ drawingGeofence: false }),

  removeGeofence: (id) => set((s) => ({
    geofences: s.geofences.filter((g) => g.id !== id),
  })),

  updateGeofence: (id, updates) => set((s) => ({
    geofences: s.geofences.map((g) => g.id === id ? { ...g, ...updates } : g),
  })),

  toggleGeofence: (id) => set((s) => ({
    geofences: s.geofences.map((g) => g.id === id ? { ...g, active: !g.active } : g),
  })),

  setGeofenceManagerOpen: (open) => set({ geofenceManagerOpen: open }),
}));
