import { describe, it, expect } from 'vitest';
import { destinationPoint, predictTrack } from './prediction';

describe('prediction', () => {
  it('moves north by roughly the requested distance', () => {
    const [lat, lng] = destinationPoint(37.77, -122.41, 0, 1000);
    expect(lat - 37.77).toBeCloseTo(1000 / 111195, 4);
    expect(lng).toBeCloseTo(-122.41, 6);
  });
  it('moves east with heading 90', () => {
    const [lat, lng] = destinationPoint(0, 10, 90, 111195);
    expect(lat).toBeCloseTo(0, 4);
    expect(lng).toBeCloseTo(11, 2);
  });
  it.each([null, undefined, NaN, Infinity, '90', false])('does not invent a northbound track for an unknown heading: %j', (heading) => {
    expect(predictTrack({ lat: 20, lng: 30 }, 10, heading)).toEqual([]);
  });
  it.each([{ lat: null, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: 0, lng: NaN }])(
    'rejects invalid origins %j', (pos) => expect(predictTrack(pos, 10, 0)).toEqual([]),
  );
  it.each([[120, 0], [120, -1], [Infinity, 30], [120, NaN], [-1, 30], [120, 0.001]])(
    'rejects invalid or excessive sampling ranges %j/%j', (horizon, step) => {
      expect(predictTrack({ lat: 0, lng: 0 }, 10, 0, horizon, step)).toEqual([]);
    },
  );
  it('accepts genuine north heading and zero origin', () => {
    const track = predictTrack({ lat: 0, lng: 0 }, 10, 0);
    expect(track).toHaveLength(5);
    expect(track[1][0]).toBeGreaterThan(0);
    expect(track[1][1]).toBeCloseTo(0);
  });
  it('builds a track and returns nothing when stationary', () => {
    const pos = { lat: 37.77, lng: -122.41 };
    expect(predictTrack(pos, 10, 90, 120, 30)).toHaveLength(5);
    expect(predictTrack(pos, 0, 90)).toEqual([]);
    expect(predictTrack(null, 10, 90)).toEqual([]);
  });
});
