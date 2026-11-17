/** Only observed, representable numeric timestamps belong in historical activity charts. */
export function validTimedEvents(events, now) {
  return (Array.isArray(events) ? events : []).filter((event) => event
    && Number.isFinite(event.time) && Math.abs(event.time) <= 8.64e15 && event.time <= now);
}

export function eventWindow(events, now, bucketCount) {
  const oldest = events.reduce((min, event) => Math.min(min, event.time), now);
  return { oldest, step: Math.max(now - oldest, 60000) / bucketCount };
}

const BUCKET_COUNT = 12;
const SEVERITY_MAP = { info: 'low', warning: 'medium', critical: 'critical' };

export function bucketEvents(events) {
  const now = Date.now();
  events = validTimedEvents(events, now);
  if (events.length === 0) return [];

  const { oldest, step } = eventWindow(events, now, BUCKET_COUNT);

  const buckets = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    time: oldest + i * step,
    label: formatBucketTime(oldest + i * step),
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }));

  events.forEach((evt) => {
    const idx = Math.min(
      Math.floor((evt.time - oldest) / step),
      BUCKET_COUNT - 1,
    );
    const level = Object.hasOwn(SEVERITY_MAP, evt.severity) ? SEVERITY_MAP[evt.severity] : 'low';
    buckets[idx][level]++;
  });

  return buckets;
}

function formatBucketTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}


const ROWS = 4;
const COLS = 12;
const SEVERITY_TO_ROW = { critical: 0, warning: 1, info: 2, detection: 3 };

export function buildGrid(events) {
  const now = Date.now();
  events = validTimedEvents(events, now);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  if (events.length === 0) return { grid, colLabels: [] };

  const { oldest, step } = eventWindow(events, now, COLS);

  const colLabels = Array.from({ length: COLS }, (_, i) => {
    const d = new Date(oldest + i * step);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  events.forEach((evt) => {
    const col = Math.min(Math.floor((evt.time - oldest) / step), COLS - 1);
    const row = Object.hasOwn(SEVERITY_TO_ROW, evt.severity) ? SEVERITY_TO_ROW[evt.severity]
      : Object.hasOwn(SEVERITY_TO_ROW, evt.type) ? SEVERITY_TO_ROW[evt.type] : 3;
    grid[row][col]++;
  });

  return { grid, colLabels };
}

