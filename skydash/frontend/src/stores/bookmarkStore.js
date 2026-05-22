import { create } from 'zustand';

const STORAGE_KEY = 'skydash_bookmarks';

const DEFAULT_BOOKMARKS = [
  {
    id: 'bk-default-1',
    name: 'High Threat Entities',
    type: 'filter',
    config: { types: [], threat: 'high', confidence: null, sort: 'threat', searchQuery: '' },
    createdAt: Date.now(),
  },
  {
    id: 'bk-default-2',
    name: 'Vehicles Only',
    type: 'filter',
    config: { types: ['vehicle'], threat: null, confidence: null, sort: 'name', searchQuery: '' },
    createdAt: Date.now(),
  },
  {
    id: 'bk-default-3',
    name: 'Default Map View',
    type: 'mapview',
    config: { center: [37.7755, -122.4180], zoom: 14, layers: { satellite: false, grid: true, flightPath: true, adsb: true, heatmap: true, entities: true, fleet: true, geofences: true } },
    createdAt: Date.now(),
  },
];

const loadBookmarks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_BOOKMARKS;
  } catch {
    return DEFAULT_BOOKMARKS;
  }
};

const persist = (bookmarks) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); } catch { /* noop */ }
};

export const useBookmarkStore = create((set, get) => ({
  bookmarks: loadBookmarks(),
  activeBookmarkId: null,

  addBookmark: (bookmark) => {
    const entry = {
      ...bookmark,
      id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const next = [...get().bookmarks, entry];
    set({ bookmarks: next });
    persist(next);
    return entry;
  },

  removeBookmark: (id) => {
    const next = get().bookmarks.filter((b) => b.id !== id);
    const activeId = get().activeBookmarkId === id ? null : get().activeBookmarkId;
    set({ bookmarks: next, activeBookmarkId: activeId });
    persist(next);
  },

  renameBookmark: (id, name) => {
    const next = get().bookmarks.map((b) => (b.id === id ? { ...b, name } : b));
    set({ bookmarks: next });
    persist(next);
  },

  setActive: (id) => set({ activeBookmarkId: id }),
  clearActive: () => set({ activeBookmarkId: null }),

  getByType: (type) => get().bookmarks.filter((b) => b.type === type),
}));
