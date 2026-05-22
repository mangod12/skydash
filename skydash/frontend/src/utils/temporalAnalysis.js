/**
 * Temporal analysis utilities for timeline correlation.
 * Groups events across entities by time proximity and builds timeline data.
 */

const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const TIME_RANGES = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

/**
 * Find correlated events — groups events within a time window across different entities.
 * Returns array of correlation groups: { time, events: [...], entityIds: Set }
 */
export function findCorrelations(events, windowMs = DEFAULT_WINDOW_MS) {
  if (!events || events.length < 2) return [];

  const sorted = [...events]
    .filter((e) => e.entityId)
    .sort((a, b) => a.time - b.time);

  const correlations = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;

    const group = [sorted[i]];
    const entityIds = new Set([sorted[i].entityId]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      if (sorted[j].time - sorted[i].time > windowMs) break;
      if (entityIds.has(sorted[j].entityId)) continue;

      group.push(sorted[j]);
      entityIds.add(sorted[j].entityId);
      used.add(sorted[j].id);
    }

    if (group.length >= 2) {
      used.add(sorted[i].id);
      const avgTime = group.reduce((sum, e) => sum + e.time, 0) / group.length;
      correlations.push({
        time: avgTime,
        events: group,
        entityIds: [...entityIds],
      });
    }
  }

  return correlations;
}

/**
 * Build structured timeline data for multi-entity rendering.
 * Returns { lanes: [{ entity, events }], timeRange: { start, end } }
 */
export function buildTimeline(entities, events, rangeKey = 'all') {
  const rangeDuration = TIME_RANGES[rangeKey] ?? TIME_RANGES.all;
  const now = Date.now();
  const cutoff = rangeDuration === Infinity ? 0 : now - rangeDuration;

  const filteredEvents = events.filter((e) => e.time >= cutoff);
  const _entityIds = new Set(entities.map((e) => e.id));

  const lanes = entities.map((entity) => ({
    entity,
    events: filteredEvents
      .filter((e) => e.entityId === entity.id)
      .sort((a, b) => a.time - b.time),
  }));

  const allTimes = filteredEvents.map((e) => e.time);
  const start = allTimes.length > 0 ? Math.min(...allTimes) : now - 3600000;
  const end = allTimes.length > 0 ? Math.max(...allTimes) : now;
  const padding = Math.max((end - start) * 0.05, 60000);

  return {
    lanes,
    timeRange: { start: start - padding, end: end + padding },
  };
}

/**
 * Create a time-to-pixel scale function.
 * Returns { toX(time), toTime(x), tickMarks: [...] }
 */
export function getTimeScale(start, end, width) {
  const duration = Math.max(end - start, 1);

  const toX = (time) => ((time - start) / duration) * width;
  const toTime = (x) => start + (x / width) * duration;

  const tickMarks = generateTicks(start, end, width);

  return { toX, toTime, tickMarks };
}

/**
 * Generate sensible tick marks for the given time range and pixel width.
 */
function generateTicks(start, end, width) {
  const duration = end - start;
  const maxTicks = Math.floor(width / 80);
  const intervals = [
    60000, 300000, 600000, 1800000, 3600000,
    21600000, 43200000, 86400000,
  ];

  let interval = intervals[intervals.length - 1];
  for (const iv of intervals) {
    if (duration / iv <= maxTicks) { interval = iv; break; }
  }

  const ticks = [];
  const firstTick = Math.ceil(start / interval) * interval;
  for (let t = firstTick; t <= end; t += interval) {
    ticks.push(t);
  }
  return ticks;
}

/**
 * Format a timestamp for tick labels, adjusting to the zoom level.
 */
export function formatTickLabel(time, rangeDuration) {
  const d = new Date(time);
  if (rangeDuration > 86400000) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export { TIME_RANGES };
