/**
 * Risk Score Engine — computes dynamic 0-100 risk scores for entities.
 * All functions are pure — no side effects or store access.
 */

import { distanceBetween } from './coordinates';

const BASE_THREAT = { low: 10, medium: 30, high: 60, critical: 90 };
const THREAT_ORDER = ['low', 'medium', 'high', 'critical'];

const RELATIONSHIP_BONUS_PER = 5;
const RELATIONSHIP_BONUS_MAX = 20;
const RECENT_EVENT_BONUS_PER = 3;
const RECENT_EVENT_BONUS_MAX = 15;
const PROXIMITY_BONUS = 10;
const PROXIMITY_THRESHOLD_M = 1000;
const ESCALATION_BONUS = 15;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Count relationships involving an entity.
 */
function countRelationships(entityId, relationships) {
  return relationships.filter(
    (r) => r.from === entityId || r.to === entityId,
  ).length;
}

/**
 * Count events for an entity in the last 24 hours.
 */
function countRecentEvents(entityId, events) {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  return events.filter(
    (e) => e.entityId === entityId && e.time > cutoff,
  ).length;
}

/**
 * Check if any critical-threat entity is within 1 km.
 */
function hasProximityCritical(entity, allEntities) {
  if (!entity.coordinates) return false;
  const [lat, lng] = entity.coordinates;

  return allEntities.some((other) => {
    if (other.id === entity.id) return false;
    if (other.threatLevel !== 'critical') return false;
    if (!other.coordinates) return false;
    const dist = distanceBetween(lat, lng, other.coordinates[0], other.coordinates[1]);
    return dist <= PROXIMITY_THRESHOLD_M;
  });
}

/**
 * Detect if threat level has escalated based on recent critical/alert events.
 */
function hasEscalationTrend(entityId, events) {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  const recentCritical = events.filter(
    (e) =>
      e.entityId === entityId &&
      e.time > cutoff &&
      (e.severity === 'critical' || e.severity === 'warning'),
  );
  return recentCritical.length >= 2;
}

/**
 * Calculate a risk score for a single entity (0-100).
 * @param {object} entity - Entity with threatLevel, confidence, coordinates
 * @param {object[]} relationships - All relationships
 * @param {object[]} events - All events
 * @param {object[]} allEntities - All entities (for proximity check)
 * @returns {{ score: number, breakdown: object }}
 */
export function calculateRiskScore(entity, relationships, events, allEntities = []) {
  const baseThreat = BASE_THREAT[entity.threatLevel] ?? 0;
  const relCount = countRelationships(entity.id, relationships);
  const relBonus = Math.min(relCount * RELATIONSHIP_BONUS_PER, RELATIONSHIP_BONUS_MAX);
  const recentCount = countRecentEvents(entity.id, events);
  const activityBonus = Math.min(recentCount * RECENT_EVENT_BONUS_PER, RECENT_EVENT_BONUS_MAX);
  const confidenceMultiplier = (entity.confidence ?? 50) / 100;
  const proximityBonus = hasProximityCritical(entity, allEntities) ? PROXIMITY_BONUS : 0;
  const escalationBonus = hasEscalationTrend(entity.id, events) ? ESCALATION_BONUS : 0;

  const raw = baseThreat + relBonus + activityBonus + proximityBonus + escalationBonus;
  const score = Math.min(100, Math.max(0, Math.round(raw * confidenceMultiplier)));

  return {
    score,
    breakdown: {
      baseThreat,
      relBonus,
      activityBonus,
      confidenceMultiplier,
      proximityBonus,
      escalationBonus,
    },
  };
}

/**
 * Map a 0-100 score to a risk level label.
 */
export function getRiskLevel(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'minimal';
}

/**
 * Map a 0-100 score to a Tailwind text color class.
 */
export function getRiskColor(score) {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-emerald-400';
  return 'text-zinc-400';
}

/**
 * Map a 0-100 score to a Tailwind bar/fill color class.
 */
export function getRiskBarColor(score) {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-emerald-500';
  return 'bg-zinc-500';
}

/**
 * Map a 0-100 score to an SVG stroke color hex.
 */
export function getRiskStrokeColor(score) {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#10b981';
  return '#71717a';
}

/**
 * Score every entity and return a sorted array (highest risk first).
 * Each item: { entity, score, breakdown, level, color }
 */
export function scoreAllEntities(entities, relationships, events) {
  return entities
    .map((entity) => {
      const { score, breakdown } = calculateRiskScore(
        entity, relationships, events, entities,
      );
      return {
        entity,
        score,
        breakdown,
        level: getRiskLevel(score),
        color: getRiskColor(score),
      };
    })
    .sort((a, b) => b.score - a.score);
}
