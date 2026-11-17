export const WARN_MS = 60 * 1000;

/** Idle limit in ms from VITE_IDLE_TIMEOUT_MINUTES (default 15). 0 or invalid-negative disables. */
export function idleLimitMs(env = import.meta.env) {
  const raw = env?.VITE_IDLE_TIMEOUT_MINUTES;
  if (raw === undefined || raw === '') return 15 * 60 * 1000;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return minutes * 60 * 1000;
}

/** 'active' | 'warning' | 'expired' for the time since the last user activity. */
export function idleState(idleMs, limitMs, warnMs = WARN_MS) {
  if (!limitMs) return 'active';
  if (idleMs >= limitMs) return 'expired';
  if (idleMs >= limitMs - Math.min(warnMs, limitMs)) return 'warning';
  return 'active';
}
