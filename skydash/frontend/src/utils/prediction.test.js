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
  it('builds a track and returns nothing when stationary', () => {
    const pos = { lat: 37.77, lng: -122.41 };
    expect(predictTrack(pos, 10, 90, 120, 30)).toHaveLength(5);
    expect(predictTrack(pos, 0, 90)).toEqual([]);
    expect(predictTrack(null, 10, 90)).toEqual([]);
  });
});
