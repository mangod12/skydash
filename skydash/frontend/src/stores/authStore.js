import { create } from 'zustand';
import { API_BASE } from '../utils/runtimeConfig';

const API = API_BASE;

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('skydash_token'),
  user: JSON.parse(localStorage.getItem('skydash_user') || 'null'),
  authEnabled: null,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('skydash_token', data.data.token);
        localStorage.setItem('skydash_user', JSON.stringify(data.data.user));
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
    localStorage.removeItem('skydash_token');
    localStorage.removeItem('skydash_user');
    set({ token: null, user: null });
  },

  checkAuth: async () => {
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
