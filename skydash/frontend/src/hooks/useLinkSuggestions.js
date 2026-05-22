import { useMemo } from 'react';
import { distanceBetween } from '../utils/coordinates';

const PROXIMITY_THRESHOLD = 500; // meters
const TEMPORAL_THRESHOLD = 3600000; // 1 hour in ms
const TAG_OVERLAP_MIN = 2;

const TYPE_AFFINITY = [
  { types: ['person', 'vehicle'], rel: 'associated_with' },
  { types: ['person', 'building'], rel: 'located_at' },
  { types: ['device', 'building'], rel: 'located_at' },
  { types: ['vehicle', 'building'], rel: 'traveled_to' },
];

function makeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function getTypeAffinity(typeA, typeB) {
  return TYPE_AFFINITY.find(
    (a) =>
      (a.types[0] === typeA && a.types[1] === typeB) ||
      (a.types[0] === typeB && a.types[1] === typeA)
  );
}

function computeSuggestions(entities, relationships) {
  const existing = new Set(
    relationships.map((r) => `${makeKey(r.from, r.to)}:${r.type}`)
  );
  const existingPairs = new Set(
    relationships.map((r) => makeKey(r.from, r.to))
  );

  const raw = [];
  let idCounter = 0;

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      const pairKey = makeKey(a.id, b.id);
      const reasons = [];
      let totalConfidence = 0;
      let suggestedType = null;

      // 1. Proximity
      if (a.coordinates && b.coordinates) {
        const dist = distanceBetween(
          a.coordinates[0], a.coordinates[1],
          b.coordinates[0], b.coordinates[1]
        );
        if (dist <= PROXIMITY_THRESHOLD) {
          const proximityConf = Math.round(
            80 * (1 - dist / PROXIMITY_THRESHOLD)
          );
          reasons.push(`Within ${Math.round(dist)}m`);
          totalConfidence += proximityConf;
          suggestedType = 'located_near';
        }
      }

      // 2. Temporal overlap
      if (a.firstSeen && b.firstSeen) {
        const overlapStart = Math.max(a.firstSeen, b.firstSeen);
        const overlapEnd = Math.min(a.lastSeen, b.lastSeen);
        if (overlapEnd - overlapStart >= 0) {
          const gap = Math.max(0, overlapStart - overlapEnd);
          if (gap <= TEMPORAL_THRESHOLD) {
            reasons.push('Overlapping time window');
            totalConfidence += 25;
            if (!suggestedType) suggestedType = 'co-temporal';
          }
        }
      }

      // 3. Tag overlap
      if (a.tags?.length && b.tags?.length) {
        const shared = a.tags.filter((t) => b.tags.includes(t));
        if (shared.length >= TAG_OVERLAP_MIN) {
          reasons.push(`Shared tags: ${shared.join(', ')}`);
          totalConfidence += 15 * shared.length;
          if (!suggestedType) suggestedType = 'associated_with';
        }
      }

      // 4. Type affinity
      const affinity = getTypeAffinity(a.type, b.type);
      if (affinity) {
        reasons.push('Type affinity');
        totalConfidence += 20;
        if (!suggestedType) suggestedType = affinity.rel;
        // Prefer affinity type when combined with proximity
        if (reasons.length > 1) suggestedType = affinity.rel;
      }

      if (reasons.length === 0) continue;

      const confidence = Math.min(totalConfidence, 99);
      const key = `${pairKey}:${suggestedType}`;
      if (existing.has(key)) continue;
      // Skip if already linked with any relationship
      if (existingPairs.has(pairKey) && reasons.length < 2) continue;

      raw.push({
        id: `sug-${++idCounter}`,
        fromEntity: { id: a.id, name: a.name, type: a.type },
        toEntity: { id: b.id, name: b.name, type: b.type },
        suggestedType,
        reason: reasons.join(' + '),
        confidence,
        accepted: false,
        dismissed: false,
      });
    }
  }

  return raw.sort((a, b) => b.confidence - a.confidence);
}

export function useLinkSuggestions(entities, relationships) {
  return useMemo(
    () => computeSuggestions(entities, relationships),
    [entities, relationships]
  );
}
