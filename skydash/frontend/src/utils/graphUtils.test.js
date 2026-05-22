import { describe, it, expect } from 'vitest';
import {
  degreeCentrality,
  betweennessCentrality,
  shortestPath,
  getNeighborhood,
  detectCommunities,
  clusterLayout,
} from './graphUtils';

// Test graph: A--B--C--D, A--C (triangle A-B-C + tail to D)
const NODES = [
  { id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' },
];
const EDGES = [
  { source: 'A', target: 'B' },
  { source: 'B', target: 'C' },
  { source: 'A', target: 'C' },
  { source: 'C', target: 'D' },
];

describe('degreeCentrality', () => {
  it('returns normalized degree for each node', () => {
    const dc = degreeCentrality(NODES, EDGES);
    // A connects to B,C => 2/3
    expect(dc.get('A')).toBeCloseTo(2 / 3);
    // B connects to A,C => 2/3
    expect(dc.get('B')).toBeCloseTo(2 / 3);
    // C connects to A,B,D => 3/3 = 1
    expect(dc.get('C')).toBeCloseTo(1);
    // D connects to C => 1/3
    expect(dc.get('D')).toBeCloseTo(1 / 3);
  });

  it('returns 0 for isolated nodes', () => {
    const nodes = [{ id: 'X' }, { id: 'Y' }];
    const dc = degreeCentrality(nodes, []);
    expect(dc.get('X')).toBe(0);
    expect(dc.get('Y')).toBe(0);
  });
});

describe('betweennessCentrality', () => {
  it('identifies bridge nodes with higher centrality', () => {
    const bc = betweennessCentrality(NODES, EDGES);
    // C bridges the triangle to D, should have highest betweenness
    expect(bc.get('C')).toBeGreaterThan(bc.get('A'));
    expect(bc.get('C')).toBeGreaterThan(bc.get('D'));
  });

  it('returns values between 0 and 1', () => {
    const bc = betweennessCentrality(NODES, EDGES);
    for (const [, val] of bc) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

describe('shortestPath', () => {
  it('finds direct path between adjacent nodes', () => {
    const path = shortestPath(EDGES, 'A', 'B');
    expect(path).toEqual(['A', 'B']);
  });

  it('finds shortest path across graph', () => {
    const path = shortestPath(EDGES, 'A', 'D');
    // A->C->D (length 2) is shorter than A->B->C->D (length 3)
    expect(path).toEqual(['A', 'C', 'D']);
  });

  it('returns single-element array for same node', () => {
    expect(shortestPath(EDGES, 'A', 'A')).toEqual(['A']);
  });

  it('returns null when no path exists', () => {
    const disconnected = [{ source: 'A', target: 'B' }];
    expect(shortestPath(disconnected, 'A', 'C')).toBeNull();
  });
});

describe('getNeighborhood', () => {
  it('returns 1-hop neighbors', () => {
    const hood = getNeighborhood(EDGES, 'A', 1);
    expect(hood).toContain('A');
    expect(hood).toContain('B');
    expect(hood).toContain('C');
    expect(hood).not.toContain('D');
  });

  it('returns 2-hop neighbors', () => {
    const hood = getNeighborhood(EDGES, 'A', 2);
    expect(hood.size).toBe(4); // All nodes reachable within 2 hops
  });

  it('defaults to 2 hops', () => {
    const hood = getNeighborhood(EDGES, 'D');
    expect(hood).toContain('D');
    expect(hood).toContain('C');
    expect(hood).toContain('A');
    expect(hood).toContain('B');
  });

  it('returns only self for isolated node', () => {
    const hood = getNeighborhood([], 'Z', 3);
    expect(hood.size).toBe(1);
    expect(hood).toContain('Z');
  });
});

describe('detectCommunities', () => {
  it('returns a community label for every node', () => {
    const labels = detectCommunities(NODES, EDGES);
    expect(labels.size).toBe(4);
    for (const node of NODES) {
      expect(labels.has(node.id)).toBe(true);
    }
  });

  it('groups connected nodes into same community', () => {
    // Two disconnected components
    const nodes = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
    const edges = [
      { source: '1', target: '2' },
      { source: '3', target: '4' },
    ];
    const labels = detectCommunities(nodes, edges);
    expect(labels.get('1')).toBe(labels.get('2'));
    expect(labels.get('3')).toBe(labels.get('4'));
    expect(labels.get('1')).not.toBe(labels.get('3'));
  });
});

describe('clusterLayout', () => {
  it('returns position for every node', () => {
    const positions = clusterLayout(NODES, EDGES, 800, 600);
    expect(positions.size).toBe(4);
    for (const node of NODES) {
      const pos = positions.get(node.id);
      expect(pos).toBeDefined();
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  it('places all positions within bounds', () => {
    const W = 800, H = 600;
    const positions = clusterLayout(NODES, EDGES, W, H);
    for (const [, pos] of positions) {
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.x).toBeLessThan(W);
      expect(pos.y).toBeGreaterThan(0);
      expect(pos.y).toBeLessThan(H);
    }
  });
});
