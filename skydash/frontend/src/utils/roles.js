// Mirrors backend/rbac.py. The server enforces; the UI only hides what would be refused.
export const ROLE_LEVEL = { viewer: 0, analyst: 1, operator: 2, commander: 3 };

/** True when auth is off (no roles in play) or the role meets the minimum. */
export function roleAllows(authEnabled, role, minimum) {
  if (!authEnabled) return true;
  return (ROLE_LEVEL[role] ?? -1) >= ROLE_LEVEL[minimum];
}
