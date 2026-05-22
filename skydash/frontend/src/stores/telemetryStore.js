import { create } from 'zustand';

const MAX_HISTORY = 200;

const ALERT_RULES = [
  {
    id: 'battery-warning',
    check: (d) => d.battery_voltage < 15.0 && d.battery_voltage >= 14.5,
    severity: 'warning',
    message: 'Low Battery — RTL Recommended',
  },
  {
    id: 'battery-critical',
    check: (d) => d.battery_voltage < 14.5,
    severity: 'critical',
    message: 'Critical Battery — Emergency Landing',
  },
  {
    id: 'signal-weak',
    check: (d) => d.signal_strength < 50,
    severity: 'warning',
    message: 'Weak Signal — Connection Unstable',
  },
  {
    id: 'gps-poor',
    check: (d) => d.gps?.satellites < 6,
    severity: 'warning',
    message: 'Poor GPS — Position Unreliable',
  },
];

export const useTelemetryStore = create((set, get) => ({
  data: null,
  fleet: [],
  history: [],
  isConnected: false,
  alerts: [],
  latency: 0,
  activeDroneId: null,

  updateTelemetry: (data, latency) => {
    const state = get();
    const newHistory = [...state.history, {
      time: data.timestamp,
      altitude: data.altitude,
      battery: data.battery_voltage,
      speed: data.ground_speed,
      signal: data.signal_strength,
    }].slice(-MAX_HISTORY);

    const activeAlerts = ALERT_RULES
      .filter((rule) => rule.check(data))
      .map((rule) => ({
        id: rule.id,
        severity: rule.severity,
        message: rule.message,
        timestamp: Date.now(),
      }));

    set({
      data,
      history: newHistory,
      isConnected: true,
      alerts: activeAlerts,
      latency,
      activeDroneId: data.drone_id || state.activeDroneId,
    });
  },

  updateFleet: (fleetData) => set({ fleet: fleetData, isConnected: true }),

  setLatency: (latency) => set({ latency }),

  setDisconnected: () => set({ isConnected: false }),

  clearAlerts: () => set({ alerts: [] }),
}));
