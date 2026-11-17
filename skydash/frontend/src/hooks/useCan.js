import { useAuthStore } from '../stores/authStore';
import { roleAllows } from '../utils/roles';

/** Whether the signed-in user holds at least `minimum` (always true when auth is off). */
export function useCan(minimum) {
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const role = useAuthStore((s) => s.user?.role);
  return roleAllows(authEnabled, role, minimum);
}
