import { describe, it, expect, beforeEach } from 'vitest';
import { useIntelStore } from './intelStore';

const store = useIntelStore;

// Capture the initial state once so we can reset between tests
const initialState = { ...store.getState() };

beforeEach(() => {
  store.setState({
    entities: initialState.entities.map((e) => ({ ...e })),
    relationships: initialState.relationships.map((r) => ({ ...r })),
    events: initialState.events.map((e) => ({ ...e })),
    selectedEntityId: null,
    comparedEntities: [null, null],
    filterThreat: null,
    filterType: null,
  });
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
    store.getState().addEntity({ name: 'Test Entity', type: 'vehicle' });
    const after = store.getState().entities;
    expect(after.length).toBe(before + 1);
    const added = after[after.length - 1];
    expect(added.id).toMatch(/^ent-/);
    expect(added.name).toBe('Test Entity');
  });

  it('updateEntity modifies entity fields', () => {
    store.getState().updateEntity('ent-001', { name: 'Updated Name' });
    const entity = store.getState().entities.find((e) => e.id === 'ent-001');
    expect(entity.name).toBe('Updated Name');
  });

  it('deleteEntity removes entity and related relationships and events', () => {
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
