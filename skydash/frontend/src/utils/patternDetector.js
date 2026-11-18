import { distanceBetween } from './coordinates';

/**
 * Spatial clustering — groups entities within radiusM of each other.
 * Uses single-linkage clustering: if any member is within range, merge.
 */
export function detectSpatialClusters(entities, radiusM = 500) {
  if (!Number.isFinite(radiusM) || radiusM < 0) return [];
  const withCoords = entities.filter((e) => Array.isArray(e?.coordinates) && e.coordinates.length >= 2
    && Number.isFinite(e.coordinates[0]) && Number.isFinite(e.coordinates[1])
    && Math.abs(e.coordinates[0]) <= 90 && Math.abs(e.coordinates[1]) <= 180);
  const clusters = [];
  const assigned = new Set();

  for (const entity of withCoords) {
    if (assigned.has(entity.id)) continue;
    const group = [entity];
    assigned.add(entity.id);

    // Expand cluster with any unassigned entity within radius of any member
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of withCoords) {
        if (assigned.has(candidate.id)) continue;
        const inRange = group.some((m) =>
          distanceBetween(m.coordinates[0], m.coordinates[1], candidate.coordinates[0], candidate.coordinates[1]) <= radiusM,
        );
        if (inRange) {
          group.push(candidate);
          assigned.add(candidate.id);
          changed = true;
        }
      }
    }
    if (group.length >= 2) {
      const lat = group.reduce((s, e) => s + e.coordinates[0], 0) / group.length;
      // Unwrap longitudes around one member before averaging. Arithmetic means
      // otherwise put a 180-degree date-line cluster near Greenwich.
      const referenceLng = group[0].coordinates[1];
      const meanLng = group.reduce((s, e) => {
        let lng = e.coordinates[1];
        while (lng - referenceLng > 180) lng -= 360;
        while (lng - referenceLng < -180) lng += 360;
        return s + lng;
      }, 0) / group.length;
      const lng = meanLng > 180 ? meanLng - 360 : meanLng < -180 ? meanLng + 360 : meanLng;
      const maxR = Math.max(...group.map((e) => distanceBetween(lat, lng, e.coordinates[0], e.coordinates[1])));
      clusters.push({ centroid: [lat, lng], entities: group, radius: Math.round(maxR) });
    }
  }
  return clusters;
}

/**
 * Temporal bursts — sliding window over sorted events.
 * Returns windows where event count exceeds threshold (default >2 in 30min).
 */
export function detectTemporalBursts(events, windowMs = 1800000) {
  if (!Array.isArray(events) || !Number.isFinite(windowMs) || windowMs < 0) return [];
  const sorted = events.filter(e => e && Number.isFinite(e.time) && Math.abs(e.time) <= 8.64e15)
    .sort((a, b) => a.time - b.time);
  if (sorted.length < 3) return [];
  const bursts = [];
  let i = 0;

  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].time - sorted[i].time <= windowMs) j++;
    const count = j - i;
    if (count > 2) {
      const window = sorted.slice(i, j);
      const start = window[0].time;
      const end = window[window.length - 1].time;
      // Avoid duplicate overlapping bursts
      if (!bursts.length || start > bursts[bursts.length - 1].end) {
        bursts.push({ start, end, events: window, count });
      }
    }
    i++;
  }
  return bursts;
}

/**
 * Movement corridors — entities linked by traveled_to relationships.
 * Builds directed chains from traveled_to edges.
 */
export function detectCorridors(entities, relationships) {
  const travelEdges = relationships.filter((r) => r.type === 'traveled_to');
  if (travelEdges.length === 0) return [];

  const entityMap = Object.fromEntries(entities.map((e) => [e.id, e]));
  const adj = Object.create(null);
  for (const edge of travelEdges) {
    (adj[edge.from] ??= []).push(edge.to);
  }

  const visited = new Set();
  const corridors = [];

  for (const start of Object.keys(adj)) {
    if (visited.has(start)) continue;
    const path = [start];
    visited.add(start);
    let current = start;
    while (adj[current]?.length) {
      const next = adj[current].find((n) => !visited.has(n));
      if (!next) break;
      path.push(next);
      visited.add(next);
      current = next;
    }
    if (path.length >= 2) {
      const names = path.map((id) => entityMap[id]?.name ?? id);
      corridors.push({ path, name: names.join(' → ') });
    }
  }
  return corridors;
}

/** Hub entities — degree centrality > threshold. */
export function detectHubs(entities, relationships, minDegree = 3) {
  const validId = id => (typeof id === 'string' && id.length > 0)
    || (typeof id === 'number' && Number.isFinite(id));
  const connections = new Map();
  for (const r of (Array.isArray(relationships) ? relationships : [])) {
    if (!r || !validId(r.from) || !validId(r.to) || r.from === r.to) continue;
    if (!connections.has(r.from)) connections.set(r.from, new Set());
    if (!connections.has(r.to)) connections.set(r.to, new Set());
    connections.get(r.from).add(r.to);
    connections.get(r.to).add(r.from);
  }
  const entityMap = new Map((Array.isArray(entities) ? entities : [])
    .filter(e => e && validId(e.id)).map(e => [e.id, e]));
  return [...connections.entries()]
    .filter(([, neighbors]) => neighbors.size >= minDegree)
    .map(([id, neighbors]) => ({
      entity: entityMap.get(id) ?? { id, name: id },
      degree: neighbors.size,
      connections: [...neighbors].map(cid => entityMap.get(cid)?.name ?? cid),
    }))
    .sort((a, b) => b.degree - a.degree);
}

/** Isolated entities — zero relationships. */
export function detectIsolated(entities, relationships) {
  const connected = new Set();
  for (const r of relationships) { connected.add(r.from); connected.add(r.to); }
  return entities.filter((e) => !connected.has(e.id));
}

/** Threat escalation — high/critical entities with recent events (last hour). */
export function detectThreatEscalation(entities, events, recentMs = 3600000) {
  if (!Number.isFinite(recentMs) || recentMs < 0) return [];
  const now = Date.now();
  const cutoff = now - recentMs;
  const highThreat = (Array.isArray(entities) ? entities : []).filter((e) => e && (e.threatLevel === 'high' || e.threatLevel === 'critical'));
  const recentEvents = (Array.isArray(events) ? events : []).filter(ev => ev && Number.isFinite(ev.time)
    && ev.time >= cutoff && ev.time <= now);

  return highThreat.map((entity) => {
    const recent = recentEvents.filter((ev) => ev.entityId === entity.id);
    const risk = entity.threatLevel === 'critical' ? (recent.length >= 2 ? 'extreme' : 'critical') : (recent.length >= 2 ? 'high' : 'elevated');
    return { entity, recentEvents: recent, risk };
  }).filter((r) => r.recentEvents.length > 0)
    .sort((a, b) => b.recentEvents.length - a.recentEvents.length);
}
