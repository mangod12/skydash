import { describe, it, expect } from 'vitest';
import { normalizeFrames, clampIndex, nextIndex, formatOffset } from './replay';

const samples = [
  { timestamp: 12, altitude: 30, battery_voltage: 15.1, gps: { latitude: 1, longitude: 2 } },
  { timestamp: 10, altitude: 10, ground_speed: 4 },
  { timestamp: 'bad' },
  null,
];

describe('replay helpers', () => {
  it('normalizes, drops invalid samples and sorts by time', () => {
    const frames = normalizeFrames(samples);
    expect(frames).toHaveLength(2);
    expect(frames[0].t).toBe(10000);
    expect(frames[1]).toMatchObject({ altitude: 30, battery: 15.1, lat: 1, lng: 2 });
    expect(frames[0].lat).toBeNull();
  });

  it.each([null, undefined, '', '  ', false, true, [], {}, [12], NaN, Infinity, 1e308])(
    'does not turn invalid time into a replay frame: %j', (timestamp) => {
      expect(normalizeFrames([{ timestamp, altitude: 50 }])).toEqual([]);
    },
  );

  it('preserves zero timestamps and finite numeric strings', () => {
    expect(normalizeFrames([{ timestamp: '12.5' }, { timestamp: 0 }]).map((frame) => frame.t)).toEqual([0, 12500]);
  });

  it('returns no frames for non-arrays', () => {
    expect(normalizeFrames(undefined)).toEqual([]);
  });

  it.each([NaN, Infinity, '16', true, false, {}, []])('does not coerce malformed replay metrics: %j', value => {
    expect(normalizeFrames([{ timestamp: 1, altitude: value, battery_voltage: value,
      ground_speed: value, signal_strength: value, gps: { latitude: value, longitude: value } }])[0])
      .toEqual({ t: 1000, altitude: null, battery: null, speed: null, signal: null, lat: null, lng: null });
  });
  it('applies metric ranges without losing zero or below-origin altitude', () => {
    expect(normalizeFrames([{ timestamp: 1, altitude: -10, battery_voltage: -1, ground_speed: -1,
      signal_strength: 101, gps: { latitude: 91, longitude: 0 } }])[0])
      .toEqual({ t: 1000, altitude: -10, battery: null, speed: null, signal: null, lat: null, lng: null });
    expect(normalizeFrames([{ timestamp: 0, altitude: 0, battery_voltage: 0, ground_speed: 0,
      signal_strength: 0, gps: { latitude: 0, longitude: 0 } }])[0])
      .toEqual({ t: 0, altitude: 0, battery: 0, speed: 0, signal: 0, lat: 0, lng: 0 });
  });
  it('clamps indexes', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2.4, 5)).toBe(2);
    expect(clampIndex(1, 0)).toBe(0);
  });

  it('loops playback at the end', () => {
    expect(nextIndex(1, 3)).toBe(2);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('formats offset from the newest frame', () => {
    const frames = normalizeFrames(samples);
    expect(formatOffset(frames, 1)).toBe('now');
    expect(formatOffset(frames, 0)).toBe('-2s');
    expect(formatOffset([], 0)).toBe('0s');
  });
});
