import { create } from 'zustand';

const STORAGE_KEY = 'skydash_widgets';
const STORAGE_VERSION = 1;

const WIDGET_TYPES = [
  'stat-card', 'mini-map', 'sparkline', 'threat-gauge',
  'entity-list', 'feed', 'clock', 'weather',
];

const DEFAULT_LAYOUT = [
  { id: 'w-stat-1', type: 'stat-card', x: 1, y: 1, w: 3, h: 2, config: { metric: 'fleet' } },
  { id: 'w-stat-2', type: 'stat-card', x: 4, y: 1, w: 3, h: 2, config: { metric: 'threat' } },
  { id: 'w-stat-3', type: 'stat-card', x: 7, y: 1, w: 3, h: 2, config: { metric: 'missions' } },
  { id: 'w-stat-4', type: 'stat-card', x: 10, y: 1, w: 3, h: 2, config: { metric: 'system' } },
  { id: 'w-map-1', type: 'mini-map', x: 1, y: 3, w: 6, h: 4, config: {} },
  { id: 'w-spark-1', type: 'sparkline', x: 7, y: 3, w: 6, h: 4, config: {} },
  { id: 'w-entities', type: 'entity-list', x: 1, y: 7, w: 4, h: 4, config: {} },
  { id: 'w-feed-1', type: 'feed', x: 5, y: 7, w: 4, h: 4, config: {} },
  { id: 'w-clock-1', type: 'clock', x: 9, y: 7, w: 2, h: 2, config: {} },
  { id: 'w-weather', type: 'weather', x: 11, y: 7, w: 2, h: 2, config: {} },
  { id: 'w-gauge-1', type: 'threat-gauge', x: 9, y: 9, w: 4, h: 2, config: {} },
];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed.widgets;
  } catch {
    return null;
  }
}

function persistWidgets(widgets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, widgets }));
  } catch { /* quota exceeded — silently ignore */ }
}

let nextId = Date.now();

export const useWidgetStore = create((set, get) => ({
  widgets: loadFromStorage() || DEFAULT_LAYOUT.map((w) => ({ ...w })),
  editMode: false,
  widgetTypes: WIDGET_TYPES,

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  addWidget: (type, config = {}) => {
    const id = `w-${type}-${++nextId}`;
    const occupied = get().widgets;
    const maxY = occupied.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const widget = { id, type, x: 1, y: maxY + 1, w: 4, h: 3, config };
    const next = [...occupied, widget];
    persistWidgets(next);
    set({ widgets: next });
  },

  removeWidget: (id) => {
    const next = get().widgets.filter((w) => w.id !== id);
    persistWidgets(next);
    set({ widgets: next });
  },

  moveWidget: (id, x, y) => {
    const next = get().widgets.map((w) => (w.id === id ? { ...w, x, y } : w));
    persistWidgets(next);
    set({ widgets: next });
  },

  resizeWidget: (id, w, h) => {
    const clamped = { w: Math.max(2, Math.min(12, w)), h: Math.max(2, Math.min(8, h)) };
    const next = get().widgets.map((wid) =>
      wid.id === id ? { ...wid, w: clamped.w, h: clamped.h } : wid,
    );
    persistWidgets(next);
    set({ widgets: next });
  },

  resetLayout: () => {
    const fresh = DEFAULT_LAYOUT.map((w) => ({ ...w }));
    persistWidgets(fresh);
    set({ widgets: fresh });
  },
}));
