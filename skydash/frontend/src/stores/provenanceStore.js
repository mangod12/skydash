import { create } from 'zustand';

const uid = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

const SEED_PROVENANCE = [
  { id: 'prov-001', entityId: 'ent-001', action: 'created', actor: 'sensor', detail: 'Detected via ADS-B transponder feed', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'prov-002', entityId: 'ent-001', action: 'sourced', actor: 'osint', detail: 'Cross-referenced with traffic camera network', timestamp: new Date(Date.now() - 3000000).toISOString() },
  { id: 'prov-003', entityId: 'ent-001', action: 'confirmed', actor: 'analyst', detail: 'Visual confirmation from drone feed ALPHA-1', timestamp: new Date(Date.now() - 2400000).toISOString() },
  { id: 'prov-004', entityId: 'ent-001', action: 'classified', actor: 'analyst', detail: 'Threat level assessed as MEDIUM', timestamp: new Date(Date.now() - 1800000).toISOString() },

  { id: 'prov-005', entityId: 'ent-002', action: 'created', actor: 'sensor', detail: 'Identified by CHARLIE-3 camera facial recognition', timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'prov-006', entityId: 'ent-002', action: 'sourced', actor: 'system', detail: 'Cross-referenced with SIGINT report SR-4412', timestamp: new Date(Date.now() - 1500000).toISOString() },
  { id: 'prov-007', entityId: 'ent-002', action: 'classified', actor: 'analyst', detail: 'Threat level elevated to HIGH', timestamp: new Date(Date.now() - 900000).toISOString() },
  { id: 'prov-008', entityId: 'ent-002', action: 'confirmed', actor: 'osint', detail: 'Location confirmed via satellite imagery', timestamp: new Date(Date.now() - 600000).toISOString() },

  { id: 'prov-009', entityId: 'ent-003', action: 'created', actor: 'system', detail: 'Imported from GIS database', timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'prov-010', entityId: 'ent-003', action: 'sourced', actor: 'osint', detail: 'Satellite imagery confirms restricted access', timestamp: new Date(Date.now() - 43200000).toISOString() },
  { id: 'prov-011', entityId: 'ent-003', action: 'updated', actor: 'sensor', detail: 'Perimeter sensor data integrated', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'prov-012', entityId: 'ent-003', action: 'classified', actor: 'analyst', detail: 'Threat level set to CRITICAL', timestamp: new Date(Date.now() - 3600000).toISOString() },

  { id: 'prov-013', entityId: 'ent-004', action: 'created', actor: 'sensor', detail: 'Detected via BRAVO-2 SIGINT array', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'prov-014', entityId: 'ent-004', action: 'sourced', actor: 'system', detail: 'Cross-referenced with SIGINT report SR-4408', timestamp: new Date(Date.now() - 5400000).toISOString() },
  { id: 'prov-015', entityId: 'ent-004', action: 'disputed', actor: 'analyst', detail: 'Frequency may be commercial — needs verification', timestamp: new Date(Date.now() - 3600000).toISOString() },

  { id: 'prov-016', entityId: 'ent-005', action: 'created', actor: 'sensor', detail: 'LIDAR array triggered perimeter breach', timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'prov-017', entityId: 'ent-005', action: 'confirmed', actor: 'sensor', detail: 'CHARLIE-3 visual confirmation of breach', timestamp: new Date(Date.now() - 480000).toISOString() },
  { id: 'prov-018', entityId: 'ent-005', action: 'classified', actor: 'analyst', detail: 'Threat level set to CRITICAL', timestamp: new Date(Date.now() - 300000).toISOString() },
];

export const useProvenanceStore = create((set, get) => ({
  entries: SEED_PROVENANCE,

  addEntry: (entityId, action, detail, actor = 'analyst') => set((s) => ({
    entries: [...s.entries, {
      id: uid(),
      entityId,
      action,
      actor,
      detail,
      timestamp: new Date().toISOString(),
    }].slice(-1000),
  })),

  getForEntity: (entityId) => get().entries.filter((e) => e.entityId === entityId),

  getChain: (entityId) => {
    return get().entries
      .filter((e) => e.entityId === entityId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  getSourceCount: (entityId) => {
    const chain = get().entries.filter((e) => e.entityId === entityId);
    return new Set(chain.map((e) => e.actor)).size;
  },

  getLastVerified: (entityId) => {
    const confirmed = get().entries
      .filter((e) => e.entityId === entityId && e.action === 'confirmed')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return confirmed[0]?.timestamp ?? null;
  },
}));

/** Global helper for provenance logging without hooks */
export const logProvenance = (entityId, action, detail, actor) =>
  useProvenanceStore.getState().addEntry(entityId, action, detail, actor);
