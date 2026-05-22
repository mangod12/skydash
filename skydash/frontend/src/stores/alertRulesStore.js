import { create } from 'zustand';

const DEFAULT_RULE_IDS = new Set([
  'bat-30', 'bat-15', 'sig-50', 'alt-120', 'spd-15', 'geo-any',
]);

const DEFAULT_RULES = [
  {
    id: 'bat-30', name: 'Low Battery Warning', type: 'battery_low',
    enabled: true, config: { threshold: 30 }, severity: 'warning',
    cooldownMs: 60000, lastTriggered: 0,
  },
  {
    id: 'bat-15', name: 'Critical Battery', type: 'battery_low',
    enabled: true, config: { threshold: 15 }, severity: 'critical',
    cooldownMs: 30000, lastTriggered: 0,
  },
  {
    id: 'sig-50', name: 'Weak Signal', type: 'signal_weak',
    enabled: true, config: { threshold: 50 }, severity: 'warning',
    cooldownMs: 60000, lastTriggered: 0,
  },
  {
    id: 'alt-120', name: 'Altitude Limit', type: 'altitude_limit',
    enabled: true, config: { maxAlt: 120 }, severity: 'info',
    cooldownMs: 30000, lastTriggered: 0,
  },
  {
    id: 'spd-15', name: 'Speed Limit', type: 'speed_limit',
    enabled: true, config: { maxSpeed: 15 }, severity: 'warning',
    cooldownMs: 30000, lastTriggered: 0,
  },
  {
    id: 'geo-any', name: 'Geofence Breach', type: 'geofence_breach',
    enabled: true, config: {}, severity: 'critical',
    cooldownMs: 30000, lastTriggered: 0,
  },
];

export const RULE_TYPES = [
  'battery_low', 'signal_weak', 'altitude_limit',
  'geofence_breach', 'proximity', 'speed_limit',
];

export const isDefaultRule = (id) => DEFAULT_RULE_IDS.has(id);

export const useAlertRulesStore = create((set, get) => ({
  rules: DEFAULT_RULES,

  addRule: (rule) => set((s) => ({
    rules: [...s.rules, { ...rule, id: `rule-${Date.now()}`, lastTriggered: 0 }],
  })),

  removeRule: (id) => set((s) => ({
    rules: s.rules.filter((r) => r.id !== id),
  })),

  updateRule: (id, patch) => set((s) => ({
    rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  })),

  toggleRule: (id) => set((s) => ({
    rules: s.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
  })),

  setLastTriggered: (id, time) => set((s) => ({
    rules: s.rules.map((r) => (r.id === id ? { ...r, lastTriggered: time } : r)),
  })),

  getRules: () => get().rules,
}));
