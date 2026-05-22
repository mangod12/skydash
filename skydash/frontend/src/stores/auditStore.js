import { create } from 'zustand';

// AuditEntry shape:
// { id, timestamp, action, category, detail, entityId?, missionId? }
//
// Categories: 'entity', 'mission', 'map', 'export', 'system'
// Actions: 'create', 'update', 'delete', 'link', 'unlink', 'export', 'annotate', 'view'

const MAX_ENTRIES = 500;

const uid = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

export const useAuditStore = create((set, get) => ({
  entries: [],

  log: (action, category, detail, meta = {}) => {
    const entry = {
      id: uid(),
      timestamp: new Date().toISOString(),
      action,
      category,
      detail,
      ...meta,
    };
    set((s) => ({
      entries: [entry, ...s.entries].slice(0, MAX_ENTRIES),
    }));
  },

  getByCategory: (cat) => get().entries.filter((e) => e.category === cat),
  getByEntity: (id) => get().entries.filter((e) => e.entityId === id),
  getByMission: (id) => get().entries.filter((e) => e.missionId === id),
  clear: () => set({ entries: [] }),
}));

/** Global audit helper — call from anywhere without hooks */
export const audit = (action, category, detail, meta) =>
  useAuditStore.getState().log(action, category, detail, meta);
