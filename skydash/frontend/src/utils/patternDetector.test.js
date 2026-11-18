import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  detectSpatialClusters,
  detectTemporalBursts,
  detectHubs,
  detectCorridors,
  detectIsolated,
  detectThreatEscalation,
} from './patternDetector';

// --- Spatial clusters ---

describe('detectSpatialClusters', () => {
  it('groups entities within 500m into a cluster', () => {
    // Two points ~100m apart in SF
    const entities = [
      { id: 'a', coordinates: [37.7749, -122.4194] },
      { id: 'b', coordinates: [37.7752, -122.4190] },
    ];
    const clusters = detectSpatialClusters(entities, 500);
    expect(clusters.length).toBe(1);
    expect(clusters[0].entities).toHaveLength(2);
  });

  it('does not cluster distant entities', () => {
    // SF and Oakland (~13km apart)
    const entities = [
      { id: 'a', coordinates: [37.7749, -122.4194] },
      { id: 'b', coordinates: [37.8044, -122.2712] },
    ];
    const clusters = detectSpatialClusters(entities, 500);
    expect(clusters).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(detectSpatialClusters([])).toEqual([]);
  });

  it('returns empty array for single entity', () => {
    const entities = [{ id: 'a', coordinates: [37.7749, -122.4194] }];
    expect(detectSpatialClusters(entities)).toEqual([]);
  });

  it('isolates invalid positions without inventing clusters or corrupting centroids', () => {
    const invalid = [null, { id: 'nulls', coordinates: [null, null] },
      { id: 'string', coordinates: ['0', '0'] }, { id: 'bool', coordinates: [false, true] },
      { id: 'range', coordinates: [91, 181] }, { id: 'inf', coordinates: [Infinity, 0] }];
    const good = [{ id: 'one', coordinates: [0, 0] }, { id: 'two', coordinates: [0.001, 0.001] }];
    expect(detectSpatialClusters([...invalid, good[0]])).toEqual([]);
    const clusters = detectSpatialClusters([...invalid, ...good]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].entities.map((e) => e.id)).toEqual(['one', 'two']);
    expect(clusters[0].centroid).toEqual([0.0005, 0.0005]);
    expect(Number.isFinite(clusters[0].radius)).toBe(true);
  });

  it.each([NaN, Infinity, -1, '500', null])('rejects invalid spatial radius %j', (radius) => {
    expect(detectSpatialClusters([
      { id: 'one', coordinates: [0, 0] }, { id: 'two', coordinates: [0, 0] },
    ], radius)).toEqual([]);
  });

  it('ignores entities without coordinates', () => {
    const entities = [
      { id: 'a', coordinates: [37.7749, -122.4194] },
      { id: 'b' },
    ];
    expect(detectSpatialClusters(entities)).toEqual([]);
  });
});

// --- Temporal bursts ---

describe('detectTemporalBursts', () => {
  it('detects >2 events within 30min window', () => {
    const now = Date.now();
    const events = [
      { id: '1', time: now },
      { id: '2', time: now + 60000 },
      { id: '3', time: now + 120000 },
    ];
    const bursts = detectTemporalBursts(events, 1800000);
    expect(bursts.length).toBe(1);
    expect(bursts[0].count).toBe(3);
  });

  it('does not detect when events are spread over hours', () => {
    const now = Date.now();
    const events = [
      { id: '1', time: now },
      { id: '2', time: now + 7200000 },
    ];
    const bursts = detectTemporalBursts(events, 1800000);
    expect(bursts).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(detectTemporalBursts([])).toEqual([]);
  });

  it('returns empty array for single event', () => {
    expect(detectTemporalBursts([{ id: '1', time: Date.now() }])).toEqual([]);
  });
});

// --- Hub detection ---

describe('detectHubs', () => {
  it('flags entities with >= minDegree relationships', () => {
    const entities = [
      { id: 'hub', name: 'Hub' },
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const relationships = [
      { from: 'hub', to: 'a', type: 'associated_with' },
      { from: 'hub', to: 'b', type: 'associated_with' },
      { from: 'hub', to: 'c', type: 'associated_with' },
    ];
    const hubs = detectHubs(entities, relationships, 3);
    expect(hubs.length).toBe(1);
    expect(hubs[0].entity.id).toBe('hub');
    expect(hubs[0].degree).toBe(3);
  });

  it('returns empty when no entity meets minDegree', () => {
    const entities = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const relationships = [{ from: 'a', to: 'b', type: 'x' }];
    expect(detectHubs(entities, relationships, 3)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(detectHubs([], [])).toEqual([]);
  });
});

// --- Isolated detection ---

describe('detectIsolated', () => {
  it('flags entities with zero relationships', () => {
    const entities = [
      { id: 'connected', name: 'C' },
      { id: 'lonely', name: 'L' },
    ];
    const relationships = [{ from: 'connected', to: 'other', type: 'x' }];
    const isolated = detectIsolated(entities, relationships);
    expect(isolated).toHaveLength(1);
    expect(isolated[0].id).toBe('lonely');
  });

  it('returns all entities when no relationships', () => {
    const entities = [{ id: 'a' }, { id: 'b' }];
    expect(detectIsolated(entities, [])).toHaveLength(2);
  });

  it('returns empty when all are connected', () => {
    const entities = [{ id: 'a' }, { id: 'b' }];
    const relationships = [{ from: 'a', to: 'b', type: 'x' }];
    expect(detectIsolated(entities, relationships)).toHaveLength(0);
  });
});

// --- Threat escalation ---

describe('detectThreatEscalation', () => {
  it('detects high-threat entities with recent events', () => {
    const now = Date.now();
    const entities = [
      { id: 'e1', name: 'T1', threatLevel: 'high' },
      { id: 'e2', name: 'T2', threatLevel: 'low' },
    ];
    const events = [
      { id: 'ev1', entityId: 'e1', time: now - 600000, severity: 'warning' },
    ];
    const escalations = detectThreatEscalation(entities, events, 3600000);
    expect(escalations.length).toBe(1);
    expect(escalations[0].entity.id).toBe('e1');
  });

  it('ignores low-threat entities even with events', () => {
    const now = Date.now();
    const entities = [{ id: 'e1', threatLevel: 'low' }];
    const events = [{ id: 'ev1', entityId: 'e1', time: now - 100, severity: 'info' }];
    expect(detectThreatEscalation(entities, events)).toHaveLength(0);
  });

  it('returns empty when no events are recent', () => {
    const entities = [{ id: 'e1', threatLevel: 'critical' }];
    const events = [{ id: 'ev1', entityId: 'e1', time: Date.now() - 99999999, severity: 'info' }];
    expect(detectThreatEscalation(entities, events, 3600000)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(detectThreatEscalation([], [])).toEqual([]);
  });

  it('assigns extreme risk for critical entity with >=2 recent events', () => {
    const now = Date.now();
    const entities = [{ id: 'e1', name: 'X', threatLevel: 'critical' }];
    const events = [
      { id: 'ev1', entityId: 'e1', time: now - 100, severity: 'warning' },
      { id: 'ev2', entityId: 'e1', time: now - 200, severity: 'critical' },
    ];
    const result = detectThreatEscalation(entities, events, 3600000);
    expect(result[0].risk).toBe('extreme');
  });
});

describe('pattern identity integrity', () => {
  it.each(['constructor', '__proto__', 'toString'])('treats %s as a literal entity ID in corridors and hubs', id => {
    const entities = [{ id, name: 'Special' }, { id: 'next', name: 'Next' }];
    const relationships = [{ from: id, to: 'next', type: 'traveled_to' }];
    expect(detectCorridors(entities, relationships)).toEqual([{ path: [id, 'next'], name: 'Special → Next' }]);
    const hubs = detectHubs(entities, relationships, 1);
    expect(hubs).toHaveLength(2);
    expect(hubs.find(h => h.entity.id === id)).toMatchObject({ degree: 1, connections: ['Next'] });
  });
});

describe('pattern event time integrity', () => {
  afterEach(() => vi.useRealTimers());
  it('excludes future and invalid events from recent threat escalation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T07:00:00Z'));
    const time = Date.now();
    const entities = [{ id: 'one', threatLevel: 'critical' }];
    const events = [time + 1, Infinity, String(time), NaN, null].map(time => ({ entityId: 'one', time }));
    expect(detectThreatEscalation(entities, events)).toEqual([]);
    expect(detectThreatEscalation([null, ...entities], [null, ...events, { entityId: 'one', time }])[0].risk).toBe('critical');
  });
  it('isolates malformed event rows and timestamps before burst detection', () => {
    const good = [1, 2, 3].map(time => ({ id: String(time), time }));
    const result = detectTemporalBursts([null, {}, { time: '2' }, { time: NaN }, { time: Infinity }, ...good], 10);
    expect(result).toEqual([{ start: 1, end: 3, events: good, count: 3 }]);
  });
  it.each([null, '1000', NaN, Infinity, -1])('rejects invalid temporal windows %j', window => {
    const entities = [{ id: 'one', threatLevel: 'critical' }];
    const events = [1, 2, 3].map(time => ({ entityId: 'one', time }));
    expect(detectTemporalBursts(events, window)).toEqual([]);
    expect(detectThreatEscalation(entities, events, window)).toEqual([]);
  });
});

describe('pattern hub degree integrity', () => {
  const entities = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }];
  it('counts distinct neighbors rather than duplicate or reverse relationship records', () => {
    const relationships = [
      { from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a' },
    ];
    expect(detectHubs(entities, relationships)).toEqual([]);
    expect(detectHubs(entities, relationships, 1)).toEqual([
      { entity: entities[0], degree: 1, connections: ['Bravo'] },
      { entity: entities[1], degree: 1, connections: ['Alpha'] },
    ]);
  });
  it('ignores self-links and incomplete relationship records', () => {
    const relationships = [null, {}, { from: 'a' }, { to: 'a' }, { from: 'a', to: 'a' }];
    expect(detectHubs(entities, relationships, 1)).toEqual([]);
  });
  it('preserves distinct numeric and string IDs including zero', () => {
    const entities = [{ id: 0, name: 'Zero' }, { id: 1, name: 'Numeric' }, { id: '1', name: 'String' }];
    const relationships = [{ from: 0, to: 1 }, { from: 0, to: '1' }];
    const hubs = detectHubs(entities, relationships, 1);
    expect(hubs[0]).toEqual({ entity: entities[0], degree: 2, connections: ['Numeric', 'String'] });
    expect(hubs.slice(1).map(h => h.entity)).toEqual(entities.slice(1));
  });
});
