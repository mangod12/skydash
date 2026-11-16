import { create } from 'zustand';

const MAX_NOTIFICATIONS = 50;

const SEED_NOTIFICATIONS = [
  {
    id: 1, type: 'intel', title: 'New entities detected',
    message: '3 new entities detected near warehouse district',
    severity: 'info', timestamp: new Date(Date.now() - 720000),
    read: false, entityId: 'ent-003',
  },
  {
    id: 2, type: 'alert', title: 'Low battery warning',
    message: 'ALPHA-1 battery below 30%',
    severity: 'warning', timestamp: new Date(Date.now() - 300000),
    read: false, location: { lat: 37.7749, lon: -122.4194 },
  },
  {
    id: 3, type: 'alert', title: 'Geofence breach',
    message: 'Geofence breach: BRAVO-2 exited Zone Alpha',
    severity: 'critical', timestamp: new Date(Date.now() - 120000),
    read: false, location: { lat: 37.7849, lon: -122.4094 },
  },
  {
    id: 4, type: 'system', title: 'ADS-B feed connected',
    message: 'ADS-B feed connected — tracking 12 aircraft',
    severity: 'info', timestamp: new Date(Date.now() - 1800000),
    read: true,
  },
  {
    id: 5, type: 'mission', title: 'Mission updated',
    message: 'Mission OVERWATCH updated by analyst',
    severity: 'info', timestamp: new Date(Date.now() - 3600000),
    read: true, missionId: 'mission-001',
  },
  {
    id: 6, type: 'alert', title: 'Signal interference',
    message: 'RF interference detected on CHARLIE-3 downlink — 5.8 GHz band',
    severity: 'warning', timestamp: new Date(Date.now() - 480000),
    read: false,
  },
];

const withStatus = (list) => list.map((n) => ({ status: 'new', ...n }));

const computeUnread = (notifications) =>
  notifications.filter((n) => !n.read).length;

const useNotificationStore = create((set, get) => ({
  notifications: withStatus(SEED_NOTIFICATIONS),
  unreadCount: computeUnread(SEED_NOTIFICATIONS),

  addNotification: (notification) => set((s) => {
    const entry = {
      ...notification,
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      read: false,
      status: 'new',
      timestamp: new Date(),
    };
    const next = [entry, ...s.notifications].slice(0, MAX_NOTIFICATIONS);
    return { notifications: next, unreadCount: computeUnread(next) };
  }),

  markRead: (id) => set((s) => {
    const next = s.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    return { notifications: next, unreadCount: computeUnread(next) };
  }),

  // Workflow status for alerts: new -> acknowledged -> escalated
  setStatus: (id, status) => set((s) => {
    const next = s.notifications.map((n) =>
      n.id === id ? { ...n, status, read: true, statusAt: new Date() } : n,
    );
    return { notifications: next, unreadCount: computeUnread(next) };
  }),

  acknowledge: (id) => get().setStatus(id, 'acknowledged'),
  escalate: (id) => get().setStatus(id, 'escalated'),

  // Alerts and escalations still needing an operator decision
  getNeedsAttention: () => get().notifications.filter(
    (n) => n.type === 'alert' && n.status !== 'acknowledged'
      && (n.severity === 'critical' || n.severity === 'warning' || n.status === 'escalated'),
  ),

  markAllRead: () => set((s) => {
    const next = s.notifications.map((n) => ({ ...n, read: true }));
    return { notifications: next, unreadCount: 0 };
  }),

  dismiss: (id) => set((s) => {
    const next = s.notifications.filter((n) => n.id !== id);
    return { notifications: next, unreadCount: computeUnread(next) };
  }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  getByType: (type) => get().notifications.filter((n) => n.type === type),

  getUnread: () => get().notifications.filter((n) => !n.read),
}));

// Global notify helper (mirrors toast() pattern)
export const notify = (opts) =>
  useNotificationStore.getState().addNotification(opts);

if (import.meta.env.DEV) window.__skydash_notify = notify;

export default useNotificationStore;
