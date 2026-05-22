import { detectCommunities } from './graphUtils';

/**
 * Generate a comprehensive network intelligence summary
 * from entities, relationships, and events.
 */
export function generateNetworkSummary(entities, relationships, events) {
  const edges = relationships.map((r) => ({ source: r.from, target: r.to }));
  const nodeCount = entities.length;
  const edgeCount = relationships.length;

  // Network density: actual / possible connections
  const possibleConnections = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 1;
  const networkDensity = edgeCount / possibleConnections;

  // Degree per entity
  const degreeMap = new Map();
  entities.forEach((e) => degreeMap.set(e.id, 0));
  relationships.forEach((r) => {
    degreeMap.set(r.from, (degreeMap.get(r.from) || 0) + 1);
    degreeMap.set(r.to, (degreeMap.get(r.to) || 0) + 1);
  });

  // Hub entities: top 3 by connection count
  const sorted = [...degreeMap.entries()].sort((a, b) => b[1] - a[1]);
  const hubEntities = sorted.slice(0, 3).map(([id, count]) => {
    const entity = entities.find((e) => e.id === id);
    return { id, name: entity?.name ?? id, connections: count };
  });

  // Isolated entities: 0 connections
  const isolatedEntities = entities
    .filter((e) => (degreeMap.get(e.id) || 0) === 0)
    .map((e) => ({ id: e.id, name: e.name }));

  // Strongest links: pairs by interaction count (events involving both)
  const pairStrength = computePairStrength(relationships, events, entities);
  const strongestLinks = pairStrength.slice(0, 5);

  // Communities
  const communityLabels = detectCommunities(entities, edges);
  const communityGroups = groupByCommunity(entities, communityLabels);
  const communityCount = communityGroups.size;

  // Threat concentration per community
  const threatConcentration = computeThreatConcentration(communityGroups, entities);

  // Temporal trend
  const temporalTrend = computeTemporalTrend(events);

  // Key findings
  const keyFindings = generateKeyFindings({
    networkDensity,
    hubEntities,
    isolatedEntities,
    strongestLinks,
    communityCount,
    threatConcentration,
    temporalTrend,
    nodeCount,
    edgeCount,
  });

  return {
    networkDensity,
    hubEntities,
    isolatedEntities,
    strongestLinks,
    communityCount,
    threatConcentration,
    temporalTrend,
    keyFindings,
    nodeCount,
    edgeCount,
  };
}

function computePairStrength(relationships, events, entities) {
  const pairMap = new Map();

  relationships.forEach((r) => {
    const key = [r.from, r.to].sort().join('::');
    if (!pairMap.has(key)) {
      pairMap.set(key, { from: r.from, to: r.to, type: r.type, count: 0 });
    }
    pairMap.get(key).count += 1;
  });

  // Boost pairs that share events
  const entityEvents = new Map();
  events.forEach((evt) => {
    if (evt.entityId) {
      if (!entityEvents.has(evt.entityId)) entityEvents.set(evt.entityId, []);
      entityEvents.get(evt.entityId).push(evt);
    }
  });

  for (const [, pair] of pairMap) {
    const eventsA = entityEvents.get(pair.from) || [];
    const eventsB = entityEvents.get(pair.to) || [];
    // Temporal proximity bonus: events within 30min
    eventsA.forEach((ea) => {
      eventsB.forEach((eb) => {
        if (Math.abs(ea.time - eb.time) < 1800000) pair.count += 1;
      });
    });
  }

  return [...pairMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((p) => ({
      ...p,
      fromName: entities.find((e) => e.id === p.from)?.name ?? p.from,
      toName: entities.find((e) => e.id === p.to)?.name ?? p.to,
    }));
}

function groupByCommunity(entities, labels) {
  const groups = new Map();
  entities.forEach((e) => {
    const cid = labels.get(e.id) ?? 0;
    if (!groups.has(cid)) groups.set(cid, []);
    groups.get(cid).push(e);
  });
  return groups;
}

function computeThreatConcentration(communityGroups, entities) {
  const THREAT_SCORES = { low: 1, medium: 2, high: 3, critical: 4 };
  const result = [];

  for (const [cid, members] of communityGroups) {
    const totalThreat = members.reduce((sum, e) => sum + (THREAT_SCORES[e.threatLevel] || 0), 0);
    const avgThreat = members.length > 0 ? totalThreat / members.length : 0;
    const topEntity = members.sort((a, b) =>
      (THREAT_SCORES[b.threatLevel] || 0) - (THREAT_SCORES[a.threatLevel] || 0)
    )[0];
    result.push({
      communityId: cid,
      memberCount: members.length,
      avgThreat,
      maxThreat: topEntity?.threatLevel ?? 'low',
      label: topEntity?.name ?? `Community ${cid}`,
    });
  }

  return result.sort((a, b) => b.avgThreat - a.avgThreat);
}

function computeTemporalTrend(events) {
  if (events.length < 3) return { direction: 'stable', label: 'Insufficient data' };

  const sorted = [...events].sort((a, b) => a.time - b.time);
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstSpan = (firstHalf[firstHalf.length - 1]?.time ?? 0) - (firstHalf[0]?.time ?? 0);
  const secondSpan = (secondHalf[secondHalf.length - 1]?.time ?? 0) - (secondHalf[0]?.time ?? 0);

  const firstRate = firstSpan > 0 ? firstHalf.length / firstSpan : 0;
  const secondRate = secondSpan > 0 ? secondHalf.length / secondSpan : 0;

  if (secondRate > firstRate * 1.3) {
    return { direction: 'growing', label: 'Activity increasing' };
  }
  if (secondRate < firstRate * 0.7) {
    return { direction: 'shrinking', label: 'Activity decreasing' };
  }
  return { direction: 'stable', label: 'Stable activity' };
}

function generateKeyFindings(data) {
  const findings = [];
  const { networkDensity, hubEntities, isolatedEntities, communityCount, threatConcentration, temporalTrend, nodeCount, edgeCount } = data;

  // Density insight
  if (networkDensity > 0.5) {
    findings.push('Network is highly interconnected — most entities share direct links.');
  } else if (networkDensity < 0.15) {
    findings.push('Network is sparse — limited direct connections between entities.');
  }

  // Hub insight
  if (hubEntities.length > 0 && hubEntities[0].connections >= 3) {
    findings.push(`${hubEntities[0].name} is a critical hub with ${hubEntities[0].connections} connections.`);
  }

  // Isolation insight
  if (isolatedEntities.length > 0) {
    findings.push(`${isolatedEntities.length} isolated entit${isolatedEntities.length === 1 ? 'y requires' : 'ies require'} further link analysis.`);
  }

  // Community insight
  if (communityCount > 1) {
    findings.push(`${communityCount} distinct clusters detected — possible compartmentalized operations.`);
  }

  // Threat insight
  const criticalCommunity = threatConcentration.find((c) => c.maxThreat === 'critical');
  if (criticalCommunity) {
    findings.push(`Critical threat concentrated around ${criticalCommunity.label} cluster.`);
  }

  // Temporal insight
  if (temporalTrend.direction === 'growing') {
    findings.push('Network activity is accelerating — increased operational tempo detected.');
  } else if (temporalTrend.direction === 'shrinking') {
    findings.push('Network activity declining — possible operational pause or dispersal.');
  }

  // Scale insight
  findings.push(`${nodeCount} entities tracked across ${edgeCount} confirmed relationships.`);

  return findings;
}
