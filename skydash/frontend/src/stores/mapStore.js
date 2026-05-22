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
  geofences: [],

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
}));
