/** Compact age label for "last data" displays: 4s, 3m 05s, 2h 10m. */
export function formatAge(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '--';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}
