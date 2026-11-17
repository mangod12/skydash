import { useAuthStore } from '../stores/authStore';

/**
 * Wrapper around fetch that injects JWT auth headers
 * and handles 401 responses by triggering logout.
 */
export async function apiFetch(url, options = {}) {
  const auth = useAuthStore.getState();
  const requestToken = auth.token;
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(auth.getAuthHeader())) {
    headers.set(name, value);
  }
  const res = await fetch(url, { ...options, headers: Object.fromEntries(headers.entries()) });
  if (res.status === 401) {
    // A delayed response from an earlier session must not clear a new login.
    if (useAuthStore.getState().token === requestToken) {
      useAuthStore.getState().logout();
    }
    throw new Error('Unauthorized');
  }
  return res;
}
