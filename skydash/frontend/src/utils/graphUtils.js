/**
 * Graph algorithms for intelligence link analysis.
 * All functions are pure — no side effects.
 * Edge shape: { source: string, target: string, ... }
 */

/**
 * Build adjacency list from edges (undirected).
 */
function buildAdjacency(edges) {
  const adj = new Map();
  for (const { source, target } of edges) {
    if (!adj.has(source)) adj.set(source, new Set());
    if (!adj.has(target)) adj.set(target, new Set());
    adj.get(source).add(target);
    adj.get(target).add(source);
  }
  return adj;
}

/**
 * Degree centrality: connections per node normalized to 0-1.
 */
export function degreeCentrality(nodes, edges) {
  const adj = buildAdjacency(edges);
  const maxDeg = Math.max(1, nodes.length - 1);
  const result = new Map();
  for (const node of nodes) {
    const neighbors = adj.get(node.id);
    result.set(node.id, neighbors ? neighbors.size / maxDeg : 0);
  }
  return result;
}

/**
 * Betweenness centrality (simplified): nodes that bridge clusters.
 * Uses BFS from every node, counting shortest-path passes.
 */
export function betweennessCentrality(nodes, edges) {
  const adj = buildAdjacency(edges);
  const ids = nodes.map((n) => n.id);
  const counts = new Map();
  for (const id of ids) counts.set(id, 0);

  for (const src of ids) {
    const dist = new Map();
    const paths = new Map();
    const stack = [];
    const predecessors = new Map();

    dist.set(src, 0);
    paths.set(src, 1);
    const queue = [src];

    for (const id of ids) predecessors.set(id, []);

    let qi = 0;
    while (qi < queue.length) {
      const v = queue[qi++];
      stack.push(v);
      const neighbors = adj.get(v) || new Set();
      for (const w of neighbors) {
        if (!dist.has(w)) {
          dist.set(w, dist.get(v) + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v) + 1) {
          paths.set(w, (paths.get(w) || 0) + (paths.get(v) || 1));
          predecessors.get(w).push(v);
        }
      }
    }

    const delta = new Map();
    for (const id of ids) delta.set(id, 0);

    while (stack.length > 0) {
      const w = stack.pop();
      for (const v of predecessors.get(w)) {
        const share = ((paths.get(v) || 1) / (paths.get(w) || 1)) * (1 + delta.get(w));
        delta.set(v, delta.get(v) + share);
      }
      if (w !== src) {
        counts.set(w, counts.get(w) + delta.get(w));
      }
    }
  }

  // Normalize to 0-1
  const maxVal = Math.max(1, ...counts.values());
  const result = new Map();
  for (const [id, val] of counts) {
    result.set(id, val / maxVal);
  }
  return result;
}

/**
 * Shortest path between two nodes using BFS.
 * Returns array of node IDs or null if unreachable.
 */
export function shortestPath(edges, fromId, toId) {
  if (fromId === toId) return [fromId];

  const adj = buildAdjacency(edges);
  const visited = new Set([fromId]);
  const parent = new Map();
  const queue = [fromId];

  let qi = 0;
  while (qi < queue.length) {
    const current = queue[qi++];
    const neighbors = adj.get(current) || new Set();
    for (const next of neighbors) {
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, current);
      if (next === toId) {
        const path = [toId];
        let node = toId;
        while (node !== fromId) {
          node = parent.get(node);
          path.unshift(node);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Multi-hop neighborhood: all nodes within N hops of a given node.
 */
export function getNeighborhood(edges, nodeId, hops = 2) {
  const adj = buildAdjacency(edges);
  const visited = new Set([nodeId]);
  let frontier = new Set([nodeId]);

  for (let i = 0; i < hops; i++) {
    const nextFrontier = new Set();
    for (const id of frontier) {
      const neighbors = adj.get(id) || new Set();
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          nextFrontier.add(n);
        }
      }
    }
    frontier = nextFrontier;
  }
  return visited;
}

/**
 * Community detection via simple label propagation.
 * Each node starts with its own community, then adopts the
 * most frequent community among its neighbors.
 */
export function detectCommunities(nodes, edges) {
  const adj = buildAdjacency(edges);
  const labels = new Map();

  // Initialize: each node = own community
  for (let i = 0; i < nodes.length; i++) {
    labels.set(nodes[i].id, i);
  }

  const ids = nodes.map((n) => n.id);
  const MAX_ITER = 20;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    // Shuffle order for better convergence
    const shuffled = [...ids].sort(() => Math.random() - 0.5);

    for (const id of shuffled) {
      const neighbors = adj.get(id);
      if (!neighbors || neighbors.size === 0) continue;

      // Count neighbor label frequencies
      const freq = new Map();
      for (const n of neighbors) {
        const lbl = labels.get(n);
        freq.set(lbl, (freq.get(lbl) || 0) + 1);
      }

      // Pick most frequent label
      let bestLabel = labels.get(id);
      let bestCount = 0;
      for (const [lbl, count] of freq) {
        if (count > bestCount) {
          bestCount = count;
          bestLabel = lbl;
        }
      }

      if (bestLabel !== labels.get(id)) {
        labels.set(id, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return labels;
}

/**
 * Cluster layout: position nodes by community in a radial arrangement.
 * Communities are arranged in a circle; nodes within each cluster
 * are placed around their community center.
 */
export function clusterLayout(nodes, edges, width, height) {
  const communities = detectCommunities(nodes, edges);
  const positions = new Map();

  // Group nodes by community
  const groups = new Map();
  for (const node of nodes) {
    const cid = communities.get(node.id);
    if (!groups.has(cid)) groups.set(cid, []);
    groups.get(cid).push(node.id);
  }

  const groupEntries = [...groups.entries()];
  const cx = width / 2;
  const cy = height / 2;
  const clusterRadius = Math.min(width, height) * 0.3;

  for (let gi = 0; gi < groupEntries.length; gi++) {
    const [, members] = groupEntries[gi];
    // Community center angle
    const angle = (2 * Math.PI * gi) / groupEntries.length;
    const gcx = cx + clusterRadius * Math.cos(angle);
    const gcy = cy + clusterRadius * Math.sin(angle);

    const nodeRadius = Math.min(60, clusterRadius * 0.4);
    for (let ni = 0; ni < members.length; ni++) {
      const na = (2 * Math.PI * ni) / members.length;
      const r = members.length === 1 ? 0 : nodeRadius;
      positions.set(members[ni], {
        x: gcx + r * Math.cos(na),
        y: gcy + r * Math.sin(na),
      });
    }
  }

  return positions;
}
