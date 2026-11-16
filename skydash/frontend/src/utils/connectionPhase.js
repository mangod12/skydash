export const WAKE_GRACE_MS = 60000;

/**
 * Classify the backend link so a sleeping hosted backend reads as
 * "waking up" instead of "offline" during the first minute.
 */
export function connectionPhase({ isConnected, hasEverConnected, startedAt, now }) {
  if (isConnected) return 'connected';
  if (!hasEverConnected && now - startedAt < WAKE_GRACE_MS) return 'waking';
  return 'offline';
}
