// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-leaflet', () => ({ useMap: () => null }));

import { generateEntityHeatPoints } from './HeatmapLayer';

const ents = [
  { id: 'a', coordinates: [10, 20], threatLevel: 'critical' },
  { id: 'b', coordinates: [11, 21], threatLevel: 'low' },
  { id: 'c', threatLevel: 'high' },
];

describe('generateEntityHeatPoints', () => {
  it('is deterministic for the same data', () => {
    expect(generateEntityHeatPoints(ents, [])).toEqual(generateEntityHeatPoints(ents, []));
  });

  it('skips entities without coordinates', () => {
    const pts = generateEntityHeatPoints([{ id: 'c', threatLevel: 'high' }], []);
    expect(pts).toEqual([]);
  });

  it('puts the entity itself first at threat intensity', () => {
    const pts = generateEntityHeatPoints(ents, []);
    expect(pts[0]).toEqual({ lat: 10, lng: 20, intensity: 1 });
  });

  it('raises intensity with events, capped at 0.3 boost and 1.0 total', () => {
    const low = [{ id: 'b', coordinates: [1, 2], threatLevel: 'low' }];
    const evts = Array.from({ length: 10 }, () => ({ entityId: 'b' }));
    expect(generateEntityHeatPoints(low, [])[0].intensity).toBeCloseTo(0.3);
    expect(generateEntityHeatPoints(low, evts)[0].intensity).toBeCloseTo(0.6);
    const crit = [{ id: 'a', coordinates: [1, 2], threatLevel: 'critical' }];
    expect(generateEntityHeatPoints(crit, evts)[0].intensity).toBe(1);
  });

  it('keeps scatter points near the entity and weaker than the centre', () => {
    const pts = generateEntityHeatPoints([ents[0]], []);
    expect(pts.length).toBeGreaterThan(2);
    for (const p of pts.slice(1)) {
      expect(Math.abs(p.lat - 10)).toBeLessThan(0.01);
      expect(Math.abs(p.lng - 20)).toBeLessThan(0.01);
      expect(p.intensity).toBeLessThan(1);
    }
  });
});
