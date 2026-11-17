import { describe, expect, it } from 'vitest';
import { normalizeTelemetry } from './telemetryReadings';
import { useTelemetryStore } from '../stores/telemetryStore';

describe('telemetry scalar boundaries', () => {
  it.each([null, false, true, '', '16.2', [], {}, NaN, Infinity, -Infinity])('keeps malformed scalar readings unknown: %j', (value) => {
    const source = { drone_id: 'one', altitude: value, ground_speed: value, battery_voltage: value,
      battery_percentage: value, signal_strength: value, timestamp: value,
      gps: { latitude: value, longitude: value, satellites: value },
      attitude: { roll: value, pitch: value, yaw: value } };
    const normalized = normalizeTelemetry(source);
    for (const key of ['altitude', 'ground_speed', 'battery_voltage', 'battery_percentage', 'signal_strength', 'timestamp']) {
      expect(normalized[key]).toBeNull();
    }
    expect(normalized.attitude).toEqual({ roll: null, pitch: null, yaw: null });
    expect(normalized.gps.latitude).toBeNull();
    expect(normalized.gps.satellites).toBeNull();
    expect(source.altitude).toBe(value);
  });

  it('preserves genuine zeros, negative altitude and boolean armed state', () => {
    const normalized = normalizeTelemetry({ drone_id: 'one', altitude: -20, timestamp: 0, ground_speed: 0,
      battery_voltage: 0, battery_percentage: 0, signal_strength: 0, armed: false,
      gps: { latitude: 0, longitude: 0, altitude: -20, satellites: 0 }, attitude: { roll: 0, pitch: 0, yaw: 0 } });
    expect(normalized.altitude).toBe(-20);
    expect(normalized.timestamp).toBe(0);
    expect(normalized.armed).toBe(false);
    expect(normalized.gps).toEqual({ latitude: 0, longitude: 0, altitude: -20, satellites: 0 });
    expect(normalized.attitude).toEqual({ roll: 0, pitch: 0, yaw: 0 });
    expect(normalized.battery_percentage).toBe(0);
  });

  it('rejects impossible percentages, negative speed/voltage, malformed state and incomplete positions', () => {
    const normalized = normalizeTelemetry({ drone_id: 'one', signal_strength: 101, battery_percentage: -1,
      ground_speed: -1, battery_voltage: -1, armed: 'false', flight_mode: {}, status: [], pattern: true,
      gps: { latitude: 91, longitude: 0, satellites: 2.5 }, attitude: 'bad' });
    expect(normalized.signal_strength).toBeNull();
    expect(normalized.battery_percentage).toBeNull();
    expect(normalized.ground_speed).toBeNull();
    expect(normalized.battery_voltage).toBeNull();
    expect(normalized.armed).toBeNull();
    expect(normalized.flight_mode).toBeNull();
    expect(normalized.status).toBeNull();
    expect(normalized.pattern).toBeNull();
    expect(normalized.gps).toMatchObject({ latitude: null, longitude: null, satellites: null });
  });

  it('applies boundaries to single readings, chart history and all fleet members', () => {
    const store = useTelemetryStore.getState();
    store.updateTelemetry({ drone_id: 'one', altitude: '20', battery_voltage: '16', signal_strength: {} }, 0);
    expect(useTelemetryStore.getState().data.altitude).toBeNull();
    expect(useTelemetryStore.getState().history.at(-1).altitude).toBeNull();
    expect(useTelemetryStore.getState().alerts).toEqual([]);
    store.updateFleet([null, {}, { drone_id: 'one', ground_speed: 'fast' }, { drone_id: 'two', ground_speed: 0 }]);
    expect(useTelemetryStore.getState().fleet.map(item => item.ground_speed)).toEqual([null, 0]);
    store.updateFleet([null, {}]);
    expect(useTelemetryStore.getState().fleet).toHaveLength(2);
  });
});
