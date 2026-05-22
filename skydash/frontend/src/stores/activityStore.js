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

function seedActivities() {
  const now = Date.now();
  return [
    { id: uid(), timestamp: now - 45000, category: 'alert', action: 'Geofence breach', detail: 'BRAVO-2 exited Zone Alpha perimeter boundary', severity: 'critical', icon: CATEGORY_ICONS.alert },
    { id: uid(), timestamp: now - 90000, category: 'telemetry', action: 'Signal degraded', detail: 'CHARLIE-3 downlink SNR dropped below threshold — 5.8 GHz', severity: 'warning', icon: CATEGORY_ICONS.telemetry },
    { id: uid(), timestamp: now - 180000, category: 'intel', action: 'Entity created', detail: 'New entity TANGO-7 added to watchlist', severity: 'info', entityId: 'ent-003', icon: CATEGORY_ICONS.intel },
    { id: uid(), timestamp: now - 300000, category: 'mission', action: 'Mission started', detail: 'OVERWATCH mission activated — 3 assets assigned', severity: 'info', missionId: 'mission-001', icon: CATEGORY_ICONS.mission },
    { id: uid(), timestamp: now - 420000, category: 'alert', action: 'Battery critical', detail: 'ALPHA-1 battery at 18% — RTL recommended', severity: 'critical', icon: CATEGORY_ICONS.alert },
    { id: uid(), timestamp: now - 600000, category: 'system', action: 'Connector online', detail: 'ADS-B data feed connected — tracking 14 aircraft', severity: 'info', icon: CATEGORY_ICONS.system },
    { id: uid(), timestamp: now - 720000, category: 'intel', action: 'Threat escalated', detail: 'Entity ECHO-5 upgraded to HIGH threat level', severity: 'warning', entityId: 'ent-005', icon: CATEGORY_ICONS.intel },
    { id: uid(), timestamp: now - 900000, category: 'telemetry', action: 'Altitude alert', detail: 'BRAVO-2 exceeded 120m AGL ceiling limit', severity: 'warning', icon: CATEGORY_ICONS.telemetry },
    { id: uid(), timestamp: now - 1200000, category: 'mission', action: 'Note added', detail: 'Analyst added observation to SENTINEL mission brief', severity: 'info', missionId: 'mission-002', icon: CATEGORY_ICONS.mission },
    { id: uid(), timestamp: now - 1500000, category: 'system', action: 'User login', detail: 'Operator admin authenticated from 10.0.1.45', severity: 'info', icon: CATEGORY_ICONS.system },
    { id: uid(), timestamp: now - 1800000, category: 'intel', action: 'Link discovered', detail: 'Auto-link: TANGO-7 connected to ECHO-5 via frequency match', severity: 'info', entityId: 'ent-003', icon: CATEGORY_ICONS.intel },
    { id: uid(), timestamp: now - 2100000, category: 'alert', action: 'RF interference', detail: 'Broadband jamming detected on GPS L1 band — sector 4N', severity: 'critical', icon: CATEGORY_ICONS.alert },
    { id: uid(), timestamp: now - 2400000, category: 'mission', action: 'Entity linked', detail: '2 entities linked to mission OVERWATCH', severity: 'info', missionId: 'mission-001', icon: CATEGORY_ICONS.mission },
    { id: uid(), timestamp: now - 2700000, category: 'system', action: 'Export completed', detail: 'GeoJSON export generated — 8 entities, 12 relationships', severity: 'info', icon: CATEGORY_ICONS.system },
    { id: uid(), timestamp: now - 3000000, category: 'telemetry', action: 'Fleet online', detail: 'All 3 drones reporting nominal telemetry', severity: 'info', icon: CATEGORY_ICONS.telemetry },
    { id: uid(), timestamp: now - 3300000, category: 'intel', action: 'Pattern detected', detail: 'Frequency hopping pattern identified — 5 channels at 200ms intervals', severity: 'warning', entityId: 'ent-004', icon: CATEGORY_ICONS.intel },
    { id: uid(), timestamp: now - 3600000, category: 'system', action: 'System startup', detail: 'SkyDash platform initialized — all subsystems nominal', severity: 'info', icon: CATEGORY_ICONS.system },
    { id: uid(), timestamp: now - 3900000, category: 'alert', action: 'Perimeter alert', detail: '4 unknown individuals detected in sector 2 approach', severity: 'warning', icon: CATEGORY_ICONS.alert },
  ];
}

export const useActivityStore = create((set, get) => ({
  activities: seedActivities(),
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
