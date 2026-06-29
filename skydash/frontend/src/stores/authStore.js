import { create } from 'zustand';
import { API_BASE, API_CONFIGURED } from '../utils/runtimeConfig';

const API = API_BASE;
const storage = typeof localStorage === 'undefined' ? null : localStorage;

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
      if (data.success) {
        storage?.setItem('skydash_token', data.data.token);
        storage?.setItem('skydash_user', JSON.stringify(data.data.user));
        set({ token: data.data.token, user: data.data.user, error: null });
        return true;
      }
      set({ error: data.error || 'Login failed' });
      return false;
    } catch {
      set({ error: 'Cannot reach server' });
      return false;
    }
  },

  logout: () => {
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
      } else {
        set({ authEnabled: false });
      }
    } catch {
      set({ authEnabled: false });
    }
  },

  getAuthHeader: () => {
    const token = get().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
}));
