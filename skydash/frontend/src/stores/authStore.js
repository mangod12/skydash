import { create } from 'zustand';
import { API_BASE, API_CONFIGURED } from '../utils/runtimeConfig';

const API = API_BASE;
const storage = typeof localStorage === 'undefined' ? null : localStorage;
let loginGeneration = 0;

function readUser() {
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem('skydash_user') || 'null');
  } catch {
    return null;
  }
}

export const useAuthStore = create((set, get) => ({
  token: storage?.getItem('skydash_token') || null,
  user: readUser(),
  authEnabled: null,
  error: null,

  login: async (username, password) => {
    const generation = ++loginGeneration;
    set({ error: null });
    if (!API_CONFIGURED) {
      set({ error: 'Backend API not configured' });
      return false;
    }
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (generation !== loginGeneration) return false;
      if (data.success) {
        storage?.setItem('skydash_token', data.data.token);
        storage?.setItem('skydash_user', JSON.stringify(data.data.user));
        set({ token: data.data.token, user: data.data.user, error: null });
        return true;
      }
      set({ error: data.error || 'Login failed' });
      return false;
    } catch {
      if (generation !== loginGeneration) return false;
      set({ error: 'Cannot reach server' });
      return false;
    }
  },

  logout: () => {
    ++loginGeneration;
    // Revoke server-side so a copied token stops working now, not at expiry. Best effort.
    const tok = get().token;
    if (tok && API_CONFIGURED) {
      fetch(`${API}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
    }
    storage?.removeItem('skydash_token');
    storage?.removeItem('skydash_user');
    set({ token: null, user: null });
  },

  checkAuth: async () => {
    if (!API_CONFIGURED) {
      set({ authEnabled: false });
      return;
    }
    try {
      const res = await fetch(`${API}/api/entities`);
      if (res.status === 401) {
        set({ authEnabled: true });
      } else if (res.status >= 200 && res.status < 300) {
        set({ authEnabled: false });
      }
    } catch {
      // An outage cannot establish that authentication is disabled.
      // Retain the last known mode (or null when it has not been determined).
    }
  },

  getAuthHeader: () => {
    const token = get().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
}));
