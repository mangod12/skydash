import { useAuthStore } from '../stores/authStore';

/**
 * Wrapper around fetch that injects JWT auth headers
 * and handles 401 responses by triggering logout.
 */
export async function apiFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    ...useAuthStore.getState().getAuthHeader(),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Unauthorized');
  }
  return res;
}
