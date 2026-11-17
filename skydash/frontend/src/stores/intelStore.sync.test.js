import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntelStore } from './intelStore';
import { apiFetch } from '../utils/api';

vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));
const oldEntity = { id: 'old', name: 'Old' };
const newEntity = { id: 'new', name: 'New' };
const oldEvent = { id: 'old-event', time: 1700000000000 };
const oldEdge = { from: 'old', to: 'other' };
const reply = (data) => ({ ok: true, json: async () => ({ success: true, data }) });

beforeEach(() => {
  vi.resetAllMocks();
  useIntelStore.setState({
    entities: [oldEntity], events: [oldEvent], relationships: [oldEdge],
    loading: false, syncError: null, lastSyncedAt: 123,
  });
});

function respond(entities, graph, events) {
  for (const result of [entities, graph, events]) {
    if (result instanceof Error) apiFetch.mockRejectedValueOnce(result);
    else apiFetch.mockResolvedValueOnce(reply(result));
  }
}

describe('intel synchronization completeness', () => {
  it('keeps old events and full-sync time when the timeline is unavailable', async () => {
    respond([newEntity], { nodes: [newEntity], edges: [] }, new Error('down'));
    expect(await useIntelStore.getState().fetchIntel()).toBe(false);
    const state = useIntelStore.getState();
    expect(state.entities[0].id).toBe('new');
    expect(state.relationships).toEqual([]);
    expect(state.events).toEqual([oldEvent]);
    expect(state.lastSyncedAt).toBe(123);
    expect(state.syncError).toBe('Intel sync incomplete');
    expect(state.loading).toBe(false);
  });

  it('does not claim a complete sync while retaining stale relationships', async () => {
    respond([newEntity], new Error('graph down'), []);
    expect(await useIntelStore.getState().fetchIntel()).toBe(false);
    expect(useIntelStore.getState().relationships).toEqual([oldEdge]);
    expect(useIntelStore.getState().events).toEqual([]);
    expect(useIntelStore.getState().lastSyncedAt).toBe(123);
    expect(useIntelStore.getState().syncError).toBe('Intel sync incomplete');
  });

  it('accepts the complete graph when the redundant entity-list request fails', async () => {
    respond(new Error('list down'), { nodes: [], edges: [] }, []);
    expect(await useIntelStore.getState().fetchIntel()).toBe(true);
    expect(useIntelStore.getState().entities).toEqual([]);
    expect(useIntelStore.getState().events).toEqual([]);
    expect(useIntelStore.getState().syncError).toBeNull();
    expect(useIntelStore.getState().lastSyncedAt).toBeGreaterThan(123);
  });

  it.each([null, {}, { nodes: [] }, { nodes: {}, edges: [] }])('rejects malformed graph data %j', async (graph) => {
    respond([newEntity], graph, []);
    expect(await useIntelStore.getState().fetchIntel()).toBe(false);
    expect(useIntelStore.getState().syncError).toBe('Intel sync incomplete');
    expect(useIntelStore.getState().relationships).toEqual([oldEdge]);
  });

  it('leaves state intact when every response has an unusable shape', async () => {
    respond({}, {}, {});
    expect(await useIntelStore.getState().fetchIntel()).toBe(false);
    const state = useIntelStore.getState();
    expect(state.entities).toEqual([oldEntity]);
    expect(state.events).toEqual([oldEvent]);
    expect(state.lastSyncedAt).toBe(123);
    expect(state.syncError).toBe('Intel API unavailable');
  });
});


describe('intel refresh ordering', () => {
  it.each(['success', 'failure'])('ignores older refresh %s after a newer complete snapshot', async (outcome) => {
    const finish = [];
    for (let i = 0; i < 3; i += 1) apiFetch.mockReturnValueOnce(new Promise((resolve) => finish.push(resolve)));
    const older = useIntelStore.getState().fetchIntel();
    respond([newEntity], { nodes: [newEntity], edges: [] }, []);
    expect(await useIntelStore.getState().fetchIntel()).toBe(true);
    const syncedAt = useIntelStore.getState().lastSyncedAt;
    const oldData = [[oldEntity], { nodes: [oldEntity], edges: [oldEdge] }, [oldEvent]];
    finish.forEach((resolve, i) => resolve(outcome === 'success' ? reply(oldData[i]) : { ok: false }));
    expect(await older).toBe(false);
    expect(useIntelStore.getState().entities[0].id).toBe('new');
    expect(useIntelStore.getState().events).toEqual([]);
    expect(useIntelStore.getState().syncError).toBeNull();
    expect(useIntelStore.getState().lastSyncedAt).toBe(syncedAt);
  });

  it('keeps loading until the newest refresh completes', async () => {
    const finishOld = [];
    const finishNew = [];
    for (let i = 0; i < 3; i += 1) apiFetch.mockReturnValueOnce(new Promise((resolve) => finishOld.push(resolve)));
    const older = useIntelStore.getState().fetchIntel();
    for (let i = 0; i < 3; i += 1) apiFetch.mockReturnValueOnce(new Promise((resolve) => finishNew.push(resolve)));
    const newer = useIntelStore.getState().fetchIntel();
    finishOld.forEach((resolve) => resolve({ ok: false }));
    await older;
    expect(useIntelStore.getState().loading).toBe(true);
    const data = [[newEntity], { nodes: [newEntity], edges: [] }, []];
    finishNew.forEach((resolve, i) => resolve(reply(data[i])));
    expect(await newer).toBe(true);
    expect(useIntelStore.getState().loading).toBe(false);
  });
});
