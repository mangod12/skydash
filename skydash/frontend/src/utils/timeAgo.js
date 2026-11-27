import { formatDistanceToNow } from 'date-fns';

/**
 * Relative time that never throws. date-fns throws a RangeError on an invalid
 * date, which would blank a whole panel for one bad timestamp.
 */
export function timeAgo(ts, fallback = 'unknown') {
  if (ts == null || ts === '') return fallback;
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return fallback;
  return formatDistanceToNow(d, { addSuffix: true });
}
