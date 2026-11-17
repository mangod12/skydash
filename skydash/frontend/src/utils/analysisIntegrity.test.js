import { describe, it, expect } from 'vitest';
import { degreeCentrality, betweennessCentrality, detectCommunities } from './graphUtils';
import { generateNetworkSummary } from './networkAnalysis';
import { findCorrelations, buildTimeline, getTimeScale } from './temporalAnalysis';

const nodes = [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Bravo' }];
const edges = [{ source: 'A', target: 'B' }, { source: 'A', target: 'gone' }, { source: 'A', target: 'A' }, null];

describe('graph input integrity', () => {
  it('limits centrality and communities to the supplied entity roster', () => {
    expect(degreeCentrality(nodes, edges)).toEqual(new Map([['A', 1], ['B', 1]]));
    expect([...betweennessCentrality(nodes, edges).values()]).toEqual([0, 0]);
    const labels = detectCommunities(nodes, edges);
    expect(labels.get('A')).toBe(labels.get('B'));
    expect(labels.size).toBe(2);
  });

  it('counts unique undirected links, not duplicates, self links or missing entities', () => {
    const summary = generateNetworkSummary([...nodes, nodes[0], null], [
      { from: 'A', to: 'B' }, { from: 'B', to: 'A' }, { from: 'A', to: 'B' },
      { from: 'A', to: 'A' }, { from: 'A', to: 'gone' }, null,
    ], []);
    expect(summary.nodeCount).toBe(2);
    expect(summary.edgeCount).toBe(1);
    expect(summary.networkDensity).toBe(1);
    expect(summary.hubEntities.map((e) => e.connections)).toEqual([1, 1]);
    expect(summary.strongestLinks).toHaveLength(1);
  });

  it('does not claim acceleration from a three-event sequence with a singleton first half', () => {
    const events = [0, 1000, 2000].map((time) => ({ entityId: 'A', time }));
    expect(generateNetworkSummary(nodes, [], events).temporalTrend.label).toBe('Insufficient data');
    const stable = [0, 1000, 2000, 3000].map((time) => ({ entityId: 'A', time }));
    expect(generateNetworkSummary(nodes, [], stable).temporalTrend.direction).toBe('stable');
  });

  it('does not merge unrelated pairs whose identifiers contain separators', () => {
    const entities = ['a::b', 'c', 'a', 'b::c'].map((id) => ({ id }));
    expect(generateNetworkSummary(entities, [{ from: 'a::b', to: 'c' }, { from: 'a', to: 'b::c' }], []).strongestLinks).toHaveLength(2);
  });

  it('ignores malformed and orphan events in network temporal claims', () => {
    const events = [null, { entityId: 'A', time: '1' }, { entityId: 'A', time: Infinity }, { entityId: 'gone', time: 1 }];
    expect(generateNetworkSummary(nodes, [], events).temporalTrend.label).toBe('Insufficient data');
    expect(generateNetworkSummary(null, null, null).nodeCount).toBe(0);
    const summary = generateNetworkSummary([{ id: 'A', threatLevel: 'constructor' }], [], []);
    expect(summary.threatConcentration[0].avgThreat).toBe(0);
  });
});

describe('timeline input integrity', () => {
  it('does not mistake missing or repeated event IDs for the same event', () => {
    const events = [
      { entityId: 'A', time: 0 }, { entityId: 'B', time: 1 },
      { id: 'same', entityId: 'A', time: 100 }, { id: 'same', entityId: 'B', time: 101 },
    ];
    const groups = findCorrelations(events, 10);
    expect(groups).toHaveLength(2);
    expect(groups[0].time).toBe(0.5);
    expect(groups[1].time).toBe(100.5);
  });

  it('ignores invalid timestamps instead of producing false correlations', () => {
    expect(findCorrelations([null, { entityId: 'A', time: '0' }, { entityId: 'B', time: Infinity }, { entityId: 'B', time: 0 }])).toEqual([]);
    expect(findCorrelations([{ entityId: 'A', time: 0 }, { entityId: 'B', time: 1 }], NaN)).toEqual([]);
  });

  it('uses only visible lane events for bounds and includes dates before the epoch', () => {
    const timeline = buildTimeline(nodes, [null, { entityId: 'A', time: -1000 }, { entityId: 'gone', time: 1e12 }, { entityId: 'B', time: Infinity }]);
    expect(timeline.lanes[0].events).toHaveLength(1);
    expect(timeline.timeRange).toEqual({ start: -61000, end: 59000 });
    expect(buildTimeline(null, null).lanes).toEqual([]);
  });

  it('handles large event collections without exceeding the call argument limit', () => {
    const events = Array.from({ length: 150000 }, (_, time) => ({ entityId: 'A', time }));
    expect(buildTimeline(nodes, events).lanes[0].events).toHaveLength(150000);
  });

  it('bounds tick generation for long history and keeps degenerate scales finite', () => {
    const scale = getTimeScale(-8e15, 8e15, 800);
    expect(scale.tickMarks.length).toBeLessThanOrEqual(11);
    expect(scale.toTime(scale.toX(0))).toBe(0);
    const invalid = getTimeScale(NaN, Infinity, 0);
    expect(Number.isFinite(invalid.toX(1))).toBe(true);
    expect(Number.isFinite(invalid.toTime(1))).toBe(true);
  });
});
