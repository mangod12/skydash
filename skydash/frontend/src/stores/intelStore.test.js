import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { normalizeIntelEntity, normalizeIntelEvent, useIntelStore } from './intelStore';

const store = useIntelStore;

// Capture the initial state once so we can reset between tests
const initialState = { ...store.getState() };

beforeEach(() => {
  vi.restoreAllMocks();
  store.setState({
    entities: initialState.entities.map((e) => ({ ...e })),
    relationships: initialState.relationships.map((r) => ({ ...r })),
    events: initialState.events.map((e) => ({ ...e })),
    selectedEntityId: null,
    comparedEntities: [null, null],
    filterThreat: null,
    filterType: null,
    filterTag: null,
    loading: false,
    lastSyncedAt: null,
    syncError: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('intelStore', () => {
  it('has seed entities on init', () => {
    const entities = store.getState().entities;
    expect(entities.length).toBeGreaterThan(0);
  });

  it('has seed relationships on init', () => {
    const rels = store.getState().relationships;
    expect(rels.length).toBeGreaterThan(0);
  });

  it('has seed events on init', () => {
    const events = store.getState().events;
    expect(events.length).toBeGreaterThan(0);
  });

  it('selectEntity sets selectedEntityId', () => {
    store.getState().selectEntity('ent-001');
    expect(store.getState().selectedEntityId).toBe('ent-001');
  });

  it('clearSelection clears selectedEntityId', () => {
    store.getState().selectEntity('ent-002');
    store.getState().clearSelection();
    expect(store.getState().selectedEntityId).toBeNull();
  });

  it('addEntity creates entity with generated id', () => {
    const before = store.getState().entities.length;
    const stored = store.getState().addEntity({ name: 'Test Entity', type: 'vehicle' });
    const after = store.getState().entities;
    expect(after.length).toBe(before + 1);
    const added = after[after.length - 1];
    expect(added.id).toMatch(/^ent-/);
    expect(stored.id).toBe(added.id);
    expect(added.name).toBe('Test Entity');
  });

  it('addEntity preserves backend ids for persisted entities', () => {
    const before = store.getState().entities.length;
    const stored = store.getState().addEntity({ id: 'api-123', name: 'API Entity', type: 'device' });
    const after = store.getState().entities;
    expect(after.length).toBe(before + 1);
    expect(stored.id).toBe('api-123');
    expect(after.find((e) => e.id === 'api-123')?.name).toBe('API Entity');
  });

  it('normalizes backend epoch seconds into UI milliseconds', () => {
    const entity = normalizeIntelEntity({
      id: 'api-entity',
      name: 'Backend Entity',
      type: 'vehicle',
      firstSeen: 1760000000,
      lastSeen: 1760000100,
    });
    const event = normalizeIntelEvent({
      id: 'api-event',
      time: 1760000200,
    });

    expect(entity.firstSeen).toBe(1760000000000);
    expect(entity.lastSeen).toBe(1760000100000);
    expect(event.time).toBe(1760000200000);
  });

  it('hydrates entities, relationships, and timeline from backend snapshots', () => {
    store.getState().selectEntity('ent-001');
    store.getState().setComparedEntity(0, 'ent-002');
    store.getState().hydrateIntel({
      entities: [
        { id: 'api-001', name: 'API Vehicle', type: 'vehicle', firstSeen: 1760000000, lastSeen: 1760000100 },
        { id: 'api-002', name: 'API Facility', type: 'building', firstSeen: 1760000001, lastSeen: 1760000200 },
      ],
      relationships: [{ from: 'api-001', to: 'api-002', type: 'located_at', confidence: 80 }],
      events: [{ id: 'evt-api', entityId: 'api-001', time: 1760000300, type: 'detection' }],
    });

    const state = store.getState();
    expect(state.entities.map((e) => e.id)).toEqual(['api-001', 'api-002']);
    expect(state.relationships).toHaveLength(1);
    expect(state.events[0].time).toBe(1760000300000);
    expect(state.selectedEntityId).toBeNull();
    expect(state.comparedEntities).toEqual([null, null]);
    expect(state.lastSyncedAt).toBeGreaterThan(0);
  });

  it('updateEntity modifies entity fields', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    store.getState().updateEntity('ent-001', { name: 'Updated Name' });

    const entity = store.getState().entities.find((e) => e.id === 'ent-001');
    expect(entity.name).toBe('Updated Name');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deleteEntity removes entity and related relationships and events', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const entityId = 'ent-001';
    const relsBefore = store.getState().relationships.filter(
      (r) => r.from === entityId || r.to === entityId,
    ).length;
    expect(relsBefore).toBeGreaterThan(0);

    store.getState().deleteEntity(entityId);

    const state = store.getState();
    expect(state.entities.find((e) => e.id === entityId)).toBeUndefined();
    expect(state.relationships.filter((r) => r.from === entityId || r.to === entityId)).toHaveLength(0);
    expect(state.events.filter((e) => e.entityId === entityId)).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deleteEntity clears selectedEntityId if it matches', () => {
    store.getState().selectEntity('ent-002');
    store.getState().deleteEntity('ent-002');
    expect(store.getState().selectedEntityId).toBeNull();
  });

  it('addRelationship adds to relationships array', () => {
    const before = store.getState().relationships.length;
    store.getState().addRelationship({ from: 'ent-001', to: 'ent-005', type: 'test', confidence: 50 });
    expect(store.getState().relationships.length).toBe(before + 1);
  });

  it('getFilteredEntities filters by type', () => {
    store.getState().setFilterType('vehicle');
    const filtered = store.getState().getFilteredEntities();
    expect(filtered.length).toBeGreaterThan(0);
    filtered.forEach((e) => expect(e.type).toBe('vehicle'));
  });

  it('getFilteredEntities filters by threat level', () => {
    store.getState().setFilterThreat('critical');
    const filtered = store.getState().getFilteredEntities();
    expect(filtered.length).toBeGreaterThan(0);
    filtered.forEach((e) => expect(e.threatLevel).toBe('critical'));
  });

  it('getSelectedEntity returns correct entity', () => {
    store.getState().selectEntity('ent-003');
    const selected = store.getState().getSelectedEntity();
    expect(selected).not.toBeNull();
    expect(selected.id).toBe('ent-003');
  });

  it('getEntityRelationships returns relationships for entity', () => {
    const rels = store.getState().getEntityRelationships('ent-003');
    expect(rels.length).toBeGreaterThan(0);
    rels.forEach((r) => {
      expect(r.from === 'ent-003' || r.to === 'ent-003').toBe(true);
    });
  });
});
