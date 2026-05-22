import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const { useBookmarkStore } = await import('./bookmarkStore');

const store = useBookmarkStore;

// Snapshot initial bookmarks
const defaultBookmarks = store.getState().bookmarks.map((b) => ({ ...b }));

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  store.setState({ bookmarks: defaultBookmarks.map((b) => ({ ...b })), activeBookmarkId: null });
});

describe('bookmarkStore', () => {
  it('has 3 default bookmarks loaded', () => {
    expect(store.getState().bookmarks).toHaveLength(3);
  });

  it('addBookmark persists a new bookmark', () => {
    store.getState().addBookmark({ name: 'New BM', type: 'filter', config: {} });
    const bms = store.getState().bookmarks;
    expect(bms).toHaveLength(4);
    expect(bms[bms.length - 1].name).toBe('New BM');
    expect(bms[bms.length - 1].id).toMatch(/^bk-/);
  });

  it('removeBookmark removes a bookmark', () => {
    const entry = store.getState().addBookmark({ name: 'ToRemove', type: 'filter', config: {} });
    expect(store.getState().bookmarks).toHaveLength(4);
    store.getState().removeBookmark(entry.id);
    expect(store.getState().bookmarks).toHaveLength(3);
    expect(store.getState().bookmarks.find((b) => b.id === entry.id)).toBeUndefined();
  });

  it('renameBookmark updates the name', () => {
    const id = store.getState().bookmarks[0].id;
    store.getState().renameBookmark(id, 'Renamed');
    expect(store.getState().bookmarks.find((b) => b.id === id).name).toBe('Renamed');
  });

  it('getByType filters bookmarks correctly', () => {
    const filters = store.getState().getByType('filter');
    expect(filters.length).toBeGreaterThan(0);
    filters.forEach((b) => expect(b.type).toBe('filter'));

    const mapviews = store.getState().getByType('mapview');
    expect(mapviews.length).toBeGreaterThan(0);
    mapviews.forEach((b) => expect(b.type).toBe('mapview'));
  });
});
