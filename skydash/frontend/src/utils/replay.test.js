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
