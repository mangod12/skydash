import { describe, it, expect } from 'vitest';
import {
  detectSpatialClusters,
  detectTemporalBursts,
  detectHubs,
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
