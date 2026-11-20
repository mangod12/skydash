import { create } from 'zustand';

const MAX_ACTIVITIES = 500;

const uid = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);

const CATEGORY_ICONS = {
  intel: 'Shield',
  mission: 'Target',
  system: 'Settings',
  alert: 'AlertTriangle',
  telemetry: 'Radio',
};

export const useActivityStore = create((set, get) => ({
  activities: [],
  filter: 'all',

  addActivity: (activity) => set((s) => {
    const entry = {
      id: uid(),
      timestamp: Date.now(),
      icon: CATEGORY_ICONS[activity.category] || CATEGORY_ICONS.system,
      ...activity,
    };
    const next = [entry, ...s.activities].slice(0, MAX_ACTIVITIES);
    return { activities: next };
  }),

  setFilter: (filter) => set({ filter }),

  clear: () => set({ activities: [] }),

  getFiltered: () => {
    const { activities, filter } = get();
    if (filter === 'all') return activities;
    return activities.filter((a) => a.category === filter);
  },
}));

/** Global helper — call from anywhere without hooks */
export const logActivity = (category, action, detail, opts = {}) =>
  useActivityStore.getState().addActivity({ category, action, detail, ...opts });
