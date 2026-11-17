/**
 * Temporal analysis utilities for timeline correlation.
 * Groups events across entities by time proximity and builds timeline data.
 */

const validEvent = (e) => e && e.entityId != null && Number.isFinite(e.time) && Math.abs(e.time) <= 8.64e15;

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
  if (!Array.isArray(events) || events.length < 2 || !Number.isFinite(windowMs) || windowMs < 0) return [];

  const sorted = [...events]
    .filter(validEvent)
    .sort((a, b) => a.time - b.time);

  const correlations = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;

    const group = [sorted[i]];
    const entityIds = new Set([sorted[i].entityId]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      if (sorted[j].time - sorted[i].time > windowMs) break;
      if (entityIds.has(sorted[j].entityId)) continue;

      group.push(sorted[j]);
      entityIds.add(sorted[j].entityId);
      used.add(j);
    }

    if (group.length >= 2) {
      used.add(i);
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
  const rangeDuration = Object.hasOwn(TIME_RANGES, rangeKey) ? TIME_RANGES[rangeKey] : TIME_RANGES.all;
  const now = Date.now();
  const cutoff = rangeDuration === Infinity ? -Infinity : now - rangeDuration;

  entities = (Array.isArray(entities) ? entities : []).filter((e) => e && e.id != null);
  const entityIds = new Set(entities.map((e) => e.id));
  const filteredEvents = (Array.isArray(events) ? events : [])
    .filter((e) => validEvent(e) && entityIds.has(e.entityId) && e.time >= cutoff);

  const lanes = entities.map((entity) => ({
    entity,
    events: filteredEvents
      .filter((e) => e.entityId === entity.id)
      .sort((a, b) => a.time - b.time),
  }));

  const start = filteredEvents.length > 0 ? filteredEvents.reduce((min, e) => Math.min(min, e.time), Infinity) : now - 3600000;
  const end = filteredEvents.length > 0 ? filteredEvents.reduce((max, e) => Math.max(max, e.time), -Infinity) : now;
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
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(end - start)) {
    start = 0;
    end = 1;
  }
  if (end <= start) end = start + 1;
  width = Number.isFinite(width) && width > 0 ? width : 1;
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
  const maxTicks = Math.max(1, Math.min(1000, Math.floor(width / 80)));
  const intervals = [
    60000, 300000, 600000, 1800000, 3600000,
    21600000, 43200000, 86400000,
  ];

  let interval = Math.max(intervals[intervals.length - 1], Math.ceil(duration / maxTicks));
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
