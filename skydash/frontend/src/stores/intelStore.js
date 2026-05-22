import { create } from 'zustand';
import { logProvenance } from './provenanceStore';

// Demo entities — spread across San Francisco for visual impact
const SEED_ENTITIES = [
  {
    id: 'ent-001', type: 'vehicle', name: 'SUV-Black-4892',
    coordinates: [37.7780, -122.4160],
    properties: { plate: '4XBC892', color: 'Black', make: 'Toyota Land Cruiser', speed: '0 km/h' },
    confidence: 82, source: 'ALPHA-1 Camera', firstSeen: Date.now() - 3600000, lastSeen: Date.now() - 120000,
    tags: ['suspicious', 'repeat-visitor'], threatLevel: 'medium',
  },
  {
    id: 'ent-002', type: 'person', name: 'TANGO-7',
    coordinates: [37.7730, -122.4220],
    properties: { description: 'Male, dark jacket, carrying duffel bag', height: '~182cm', gait: 'purposeful' },
    confidence: 65, source: 'CHARLIE-3 Camera', firstSeen: Date.now() - 1800000, lastSeen: Date.now() - 60000,
    tags: ['poi', 'under-surveillance'], threatLevel: 'high',
  },
  {
    id: 'ent-003', type: 'building', name: 'Compound ECHO',
    coordinates: [37.7765, -122.4175],
    properties: { address: '451 Industrial Blvd', floors: 3, status: 'Active — Restricted Access', area: '2,400 sqm' },
    confidence: 95, source: 'GIS + Satellite', firstSeen: Date.now() - 86400000, lastSeen: Date.now(),
    tags: ['high-value-target', 'restricted'], threatLevel: 'critical',
  },
  {
    id: 'ent-004', type: 'device', name: 'RF-ANOMALY-5G',
    coordinates: [37.7758, -122.4168],
    properties: { frequency: '5.8 GHz', type: 'Unknown Transmitter', power: '+23 dBm', modulation: 'OFDM' },
    confidence: 71, source: 'BRAVO-2 SIGINT', firstSeen: Date.now() - 7200000, lastSeen: Date.now() - 300000,
    tags: ['electronic-warfare', 'anomalous'], threatLevel: 'medium',
  },
  {
    id: 'ent-005', type: 'event', name: 'Perimeter Breach — Sector 4',
    coordinates: [37.7795, -122.4140],
    properties: { zone: 'North Perimeter', sensor: 'LIDAR-Array-A3', duration: '14s' },
    confidence: 94, source: 'Perimeter Sensor Grid', firstSeen: Date.now() - 600000, lastSeen: Date.now() - 600000,
    tags: ['alert', 'security-breach', 'active'], threatLevel: 'critical',
  },
  {
    id: 'ent-006', type: 'vehicle', name: 'Sedan-White-7721',
    coordinates: [37.7710, -122.4240],
    properties: { plate: '7ABX721', color: 'White', make: 'Honda Civic', occupants: '2' },
    confidence: 77, source: 'CHARLIE-3 ANPR', firstSeen: Date.now() - 2400000, lastSeen: Date.now() - 900000,
    tags: ['tracked'], threatLevel: 'low',
  },
  {
    id: 'ent-007', type: 'person', name: 'FOXTROT-3',
    coordinates: [37.7800, -122.4130],
    properties: { description: 'Female, red coat, phone in hand', behavior: 'loitering near gate' },
    confidence: 58, source: 'ALPHA-1 Camera', firstSeen: Date.now() - 900000, lastSeen: Date.now() - 180000,
    tags: ['poi'], threatLevel: 'low',
  },
  {
    id: 'ent-008', type: 'building', name: 'Logistics Hub DELTA',
    coordinates: [37.7720, -122.4190],
    properties: { address: '280 Cargo Way', floors: 1, status: 'Operational', vehicles_present: 4 },
    confidence: 88, source: 'GIS + Drone Overwatch', firstSeen: Date.now() - 172800000, lastSeen: Date.now(),
    tags: ['logistics', 'vehicle-depot'], threatLevel: 'medium',
  },
];

const SEED_RELATIONSHIPS = [
  { from: 'ent-001', to: 'ent-003', type: 'located_at', confidence: 88 },
  { from: 'ent-002', to: 'ent-003', type: 'traveled_to', confidence: 72 },
  { from: 'ent-002', to: 'ent-001', type: 'associated_with', confidence: 55 },
  { from: 'ent-004', to: 'ent-003', type: 'located_at', confidence: 80 },
  { from: 'ent-005', to: 'ent-003', type: 'located_at', confidence: 95 },
  { from: 'ent-006', to: 'ent-008', type: 'located_at', confidence: 70 },
  { from: 'ent-007', to: 'ent-005', type: 'associated_with', confidence: 40 },
  { from: 'ent-001', to: 'ent-008', type: 'traveled_to', confidence: 65 },
  { from: 'ent-002', to: 'ent-008', type: 'traveled_to', confidence: 48 },
];

const SEED_EVENTS = [
  { id: 'evt-001', time: Date.now() - 7200000, type: 'detection', description: 'ALPHA-1 deployed — orbit pattern established around Compound ECHO', entityId: 'ent-003', severity: 'info' },
  { id: 'evt-002', time: Date.now() - 5400000, type: 'detection', description: 'BRAVO-2 initiated grid search of northern sector', entityId: null, severity: 'info' },
  { id: 'evt-003', time: Date.now() - 3600000, type: 'detection', description: 'Vehicle SUV-Black-4892 detected entering surveillance zone', entityId: 'ent-001', severity: 'info' },
  { id: 'evt-004', time: Date.now() - 2700000, type: 'detection', description: 'ANPR match: plate 4XBC892 flagged in watch database', entityId: 'ent-001', severity: 'warning' },
  { id: 'evt-005', time: Date.now() - 1800000, type: 'detection', description: 'Person TANGO-7 observed approaching Compound ECHO on foot', entityId: 'ent-002', severity: 'info' },
  { id: 'evt-006', time: Date.now() - 1200000, type: 'alert', description: 'RF anomaly detected — unknown 5.8GHz transmitter near compound', entityId: 'ent-004', severity: 'warning' },
  { id: 'evt-007', time: Date.now() - 600000, type: 'alert', description: 'CRITICAL: Perimeter breach Sector 4 — LIDAR array triggered', entityId: 'ent-005', severity: 'critical' },
  { id: 'evt-008', time: Date.now() - 480000, type: 'detection', description: 'CHARLIE-3 redirected to breach location for visual confirmation', entityId: 'ent-005', severity: 'info' },
  { id: 'evt-009', time: Date.now() - 300000, type: 'movement', description: 'SUV-Black-4892 repositioned 200m east toward logistics hub', entityId: 'ent-001', severity: 'warning' },
  { id: 'evt-010', time: Date.now() - 180000, type: 'detection', description: 'FOXTROT-3 identified loitering near north gate — low confidence', entityId: 'ent-007', severity: 'info' },
  { id: 'evt-011', time: Date.now() - 60000, type: 'alert', description: 'TANGO-7 entered Compound ECHO restricted zone — elevated threat', entityId: 'ent-002', severity: 'critical' },
];

export const useIntelStore = create((set, get) => ({
  entities: SEED_ENTITIES,
  relationships: SEED_RELATIONSHIPS,
  events: SEED_EVENTS,
  selectedEntityId: null,
  comparedEntities: [null, null],
  filterThreat: null,
  filterType: null,
  filterTag: null,

  selectEntity: (id) => set({ selectedEntityId: id }),
  clearSelection: () => set({ selectedEntityId: null }),

  setComparedEntity: (slot, id) => set((s) => {
    const next = [...s.comparedEntities];
    next[slot] = id;
    return { comparedEntities: next };
  }),
  clearComparison: () => set({ comparedEntities: [null, null] }),

  setFilterThreat: (level) => set({ filterThreat: level }),
  setFilterType: (type) => set({ filterType: type }),
  setFilterTag: (tag) => set({ filterTag: tag }),

  getSelectedEntity: () => {
    const state = get();
    return state.entities.find((e) => e.id === state.selectedEntityId) ?? null;
  },

  getFilteredEntities: () => {
    const { entities, filterThreat, filterType } = get();
    return entities.filter((e) => {
      if (filterThreat && e.threatLevel !== filterThreat) return false;
      if (filterType && e.type !== filterType) return false;
      return true;
    });
  },

  getEntityRelationships: (entityId) => {
    const { relationships } = get();
    return relationships.filter((r) => r.from === entityId || r.to === entityId);
  },

  getEntityEvents: (entityId) => {
    const { events } = get();
    return events.filter((e) => e.entityId === entityId).sort((a, b) => b.time - a.time);
  },

  updateEntity: (id, updates) => {
    const detail = Object.keys(updates).map((k) => `${k} changed`).join(', ');
    logProvenance(id, 'updated', detail, 'analyst');
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  deleteEntity: (id) => set((s) => ({
    entities: s.entities.filter((e) => e.id !== id),
    relationships: s.relationships.filter((r) => r.from !== id && r.to !== id),
    events: s.events.filter((e) => e.entityId !== id),
    selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
  })),

  addEntity: (entity) => {
    const newId = `ent-${Date.now()}`;
    logProvenance(newId, 'created', `Entity ${entity.name || newId} created`, 'analyst');
    set((s) => ({
      entities: [...s.entities, { ...entity, id: newId }],
    }));
  },

  addRelationship: (rel) => set((s) => ({
    relationships: [...s.relationships, rel],
  })),

  addEvent: (event) => set((s) => ({
    events: [...s.events, { ...event, id: `evt-${Date.now()}`, time: Date.now() }],
  })),
}));
