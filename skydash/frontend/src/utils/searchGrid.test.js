import { describe, expect, it } from 'vitest';
import { generateSearchGrid, searchGridGeoJSON } from './searchGrid';
const parameters = () => ({ latitude: 0, longitude: 0, widthM: 500, heightM: 400, spacingM: 100, speedMps: 8, orientation: 'east-west' });

describe('bounded search concept geometry', () => {
  it('includes both AO edges, alternating legs, straight connectors and genuine zero center', () => {
    const plan = generateSearchGrid(parameters(), 1800000000000);
    expect(plan.laneCount).toBe(5); expect(plan.route).toHaveLength(10); expect(plan.actualSpacingM).toBe(100);
    expect(plan.boundary[0]).toEqual(plan.boundary.at(-1));
    expect(plan.lanes[0][0][0]).toBeLessThan(0); expect(plan.lanes[0][1][0]).toBeGreaterThan(0);
    expect(plan.lanes[1][0][0]).toBeGreaterThan(0); expect(plan.lanes[1][1][0]).toBeLessThan(0);
    expect(plan.lanes[0][0][1]).toBe(plan.boundary[0][1]); expect(plan.lanes.at(-1)[0][1]).toBe(plan.boundary[2][1]);
    expect(plan.distanceM).toBeCloseTo(2900, 2); expect(plan.straightLineSeconds).toBe(plan.distanceM / 8);
    expect(plan.areaM2).toBe(200000);
  });
  it('supports north-south sweeps with longitude-latitude export order', () => {
    const input = { ...parameters(), latitude: 28, longitude: 77, orientation: 'north-south' };
    const plan = generateSearchGrid(input);
    expect(plan.laneCount).toBe(6); expect(plan.lanes[0][0][0]).toBe(plan.lanes[0][1][0]);
    expect(plan.lanes[0][0][1]).toBeLessThan(plan.lanes[0][1][1]);
    expect(plan.distanceM).toBeCloseTo(2900, 0);
    const feature = searchGridGeoJSON(plan).features[0]; expect(feature.geometry.coordinates[0][0][0]).toBeGreaterThan(76);
  });
  it('reduces spacing evenly rather than leaving an uncovered final strip or exceeding requested spacing', () => {
    const plan = generateSearchGrid({ ...parameters(), heightM: 450, spacingM: 200 });
    expect(plan.laneCount).toBe(4); expect(plan.actualSpacingM).toBe(150);
    const small = generateSearchGrid({ ...parameters(), heightM: 50, spacingM: 1000 });
    expect(small.laneCount).toBe(2); expect(small.actualSpacingM).toBe(50);
  });
  it.each([null, '', true, '0', NaN, Infinity, -Infinity])('rejects coerced/missing/nonfinite numeric fields %s', bad => {
    for (const key of ['latitude', 'longitude', 'widthM', 'heightM', 'spacingM', 'speedMps']) expect(() => generateSearchGrid({ ...parameters(), [key]: bad })).toThrow();
  });
  it.each([{ latitude: 75.1 }, { latitude: -75.1 }, { longitude: 181 }, { widthM: 49 }, { heightM: 5001 }, { spacingM: 9 }, { spacingM: 1001 }, { speedMps: 0 }, { speedMps: 31 }, { orientation: 'diagonal' }])('rejects unsupported operational/geometry range %j', patch => {
    expect(() => generateSearchGrid({ ...parameters(), ...patch })).toThrow();
  });
  it('rejects dateline crossing and an excessively dense sketch', () => {
    expect(() => generateSearchGrid({ ...parameters(), longitude: 179.999 })).toThrow('dateline');
    expect(() => generateSearchGrid({ ...parameters(), longitude: -179.999 })).toThrow('dateline');
    expect(() => generateSearchGrid({ ...parameters(), heightM: 5000, spacingM: 10 })).toThrow('200 lanes');
  });
  it('keeps all lane points within the bounds at high supported latitude', () => {
    for (const latitude of [-75, 75]) {
      const plan = generateSearchGrid({ ...parameters(), latitude, longitude: 80, widthM: 5000, heightM: 5000, spacingM: 100 });
      const xs = plan.boundary.map(point => point[0]); const ys = plan.boundary.map(point => point[1]);
      for (const [x, y] of plan.route) { expect(x).toBeGreaterThanOrEqual(Math.min(...xs)); expect(x).toBeLessThanOrEqual(Math.max(...xs)); expect(y).toBeGreaterThanOrEqual(Math.min(...ys)); expect(y).toBeLessThanOrEqual(Math.max(...ys)); }
    }
  });
  it('exports non-executable scope, deterministic timestamp, polygon, ordered lanes and route', () => {
    const plan = generateSearchGrid(parameters(), 1800000000000); const output = searchGridGeoJSON(plan);
    expect(output.type).toBe('FeatureCollection'); expect(output.features).toHaveLength(7);
    expect(output.properties.generatedAt).toBe(new Date(1800000000000).toISOString());
    expect(output.properties.scope).toContain('not an executable aircraft mission');
    expect(output.properties.scope).toContain('sensor coverage');
    expect(output.features.at(-1).properties.executable).toBe(false);
    expect(output.features.filter(item => item.properties.kind === 'search-lane').map(item => item.properties.sequence)).toEqual([1, 2, 3, 4, 5]);
    plan.route = [[NaN, NaN]]; expect(searchGridGeoJSON(plan).features.at(-1).geometry.coordinates).toHaveLength(10);
    expect(() => generateSearchGrid(parameters(), Infinity)).toThrow();
  });
});
