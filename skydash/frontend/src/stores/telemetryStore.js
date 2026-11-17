import { create } from 'zustand';

const MAX_HISTORY = 200;

const isReading = (value) => typeof value === 'number' && Number.isFinite(value);

const ALERT_RULES = [
  {
    id: 'battery-warning',
    check: (d) => isReading(d.battery_voltage) && d.battery_voltage < 15.0 && d.battery_voltage >= 14.5,
    severity: 'warning',
    message: 'Low Battery — RTL Recommended',
  },
  {
    id: 'battery-critical',
    check: (d) => isReading(d.battery_voltage) && d.battery_voltage < 14.5,
    severity: 'critical',
    message: 'Critical Battery — Emergency Landing',
  },
  {
    id: 'signal-weak',
    check: (d) => isReading(d.signal_strength) && d.signal_strength < 50,
    severity: 'warning',
    message: 'Weak Signal — Connection Unstable',
  },
  {
    id: 'gps-poor',
    check: (d) => isReading(d.gps?.satellites) && d.gps.satellites < 6,
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
  lastUpdate: null,
  activeDroneId: null,

  updateTelemetry: (data, latency) => {
    const state = get();
    // Never join one drone's chart trail to another drone's telemetry.
    const previousId = state.data?.drone_id;
    const changedDrone = previousId && data.drone_id && previousId !== data.drone_id;
    const history = changedDrone ? [] : state.history;
    const newHistory = [...history, {
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
      hasEverConnected: true,
      alerts: activeAlerts,
      latency,
      lastUpdate: Date.now(),
      activeDroneId: data.drone_id || state.activeDroneId,
    });
  },

  updateFleet: (fleetData) => set({
    fleet: fleetData, isConnected: true, hasEverConnected: true, lastUpdate: Date.now(),
    // An authoritative empty fleet is not a fresh reading of the last drone.
    ...(fleetData.length === 0 ? { data: null, activeDroneId: null, history: [], alerts: [] } : {}),
  }),

  setLatency: (latency) => set({ latency }),

  setActiveDroneId: (activeDroneId) => set({ activeDroneId }),

  setDisconnected: () => set({ isConnected: false }),

  clearAlerts: () => set({ alerts: [] }),
}));
