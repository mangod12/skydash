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
