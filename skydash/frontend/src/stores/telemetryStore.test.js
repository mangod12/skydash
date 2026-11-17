import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTelemetryStore } from './telemetryStore';

const sample = { drone_id: 'd1', battery_voltage: 16, signal_strength: 90, gps: { satellites: 10 } };

describe('telemetryStore lastUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTelemetryStore.setState({ lastUpdate: null, isConnected: false });
  });
  afterEach(() => vi.useRealTimers());

  it('starts with no update time', () => {
    expect(useTelemetryStore.getState().lastUpdate).toBeNull();
  });

  it('records the time of the latest telemetry frame', () => {
    vi.setSystemTime(1000);
    useTelemetryStore.getState().updateTelemetry(sample, 20);
    expect(useTelemetryStore.getState().lastUpdate).toBe(1000);
    vi.setSystemTime(9000);
    expect(useTelemetryStore.getState().lastUpdate).toBe(1000);
  });

  it('records fleet updates too', () => {
    vi.setSystemTime(5000);
    useTelemetryStore.getState().updateFleet([]);
    expect(useTelemetryStore.getState().lastUpdate).toBe(5000);
  });
});

describe('telemetry history identity', () => {
  beforeEach(() => useTelemetryStore.setState({ data: null, history: [], activeDroneId: null }));

  it('starts a new chart history when telemetry switches drones', () => {
    const update = useTelemetryStore.getState().updateTelemetry;
    update({ ...sample, timestamp: 1000, altitude: 20 }, 0);
    update({ ...sample, timestamp: 2000, altitude: 25 }, 0);
    expect(useTelemetryStore.getState().history.map((h) => h.altitude)).toEqual([20, 25]);
    // Selection may already have changed before the first new frame arrives.
    useTelemetryStore.getState().setActiveDroneId('d2');
    update({ ...sample, drone_id: 'd2', timestamp: 3000, altitude: 100 }, 0);
    expect(useTelemetryStore.getState().history.map((h) => h.altitude)).toEqual([100]);
    update({ ...sample, drone_id: 'd2', timestamp: 4000, altitude: 110 }, 0);
    expect(useTelemetryStore.getState().history.map((h) => h.altitude)).toEqual([100, 110]);
    update({ ...sample, timestamp: 5000, altitude: 30 }, 0);
    expect(useTelemetryStore.getState().history.map((h) => h.altitude)).toEqual([30]);
  });

  it('keeps the bounded history for successive frames from the same drone', () => {
    for (let i = 0; i < 250; i += 1) {
      useTelemetryStore.getState().updateTelemetry({ ...sample, timestamp: i, altitude: i }, 0);
    }
    const history = useTelemetryStore.getState().history;
    expect(history).toHaveLength(200);
    expect(history[0].altitude).toBe(50);
    expect(history.at(-1).altitude).toBe(249);
  });
});

describe('empty fleet snapshot', () => {
  it('clears selected telemetry, chart history and alerts without claiming a disconnect', () => {
    const store = useTelemetryStore.getState();
    store.updateTelemetry({ ...sample, battery_voltage: 10, altitude: 30 }, 0);
    expect(useTelemetryStore.getState().alerts.length).toBeGreaterThan(0);
    store.updateFleet([]);
    const empty = useTelemetryStore.getState();
    expect(empty.fleet).toEqual([]);
    expect(empty.data).toBeNull();
    expect(empty.activeDroneId).toBeNull();
    expect(empty.history).toEqual([]);
    expect(empty.alerts).toEqual([]);
    expect(empty.isConnected).toBe(true);
    store.updateFleet([{ ...sample, drone_id: 'next' }]);
    store.updateTelemetry({ ...sample, drone_id: 'next', altitude: 50 }, 0);
    expect(useTelemetryStore.getState().activeDroneId).toBe('next');
    expect(useTelemetryStore.getState().history).toHaveLength(1);
  });
});
