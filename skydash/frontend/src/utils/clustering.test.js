import { describe, it, expect } from 'vitest';
import { clusterEntities } from './clustering';

const e = (id, lat, lng, extra = {}) => ({ id, lat, lng, type: 'drone', threatLevel: 'low', ...extra });

describe('clusterEntities', () => {
  it('does not cluster at high zoom', () => {
    const out = clusterEntities([e('a', 37, -122), e('b', 37.00001, -122)], 16);
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.count === 1)).toBe(true);
  });

  it('groups nearby entities at low zoom and keeps the highest threat', () => {
    const out = clusterEntities(
      [e('a', 37, -122, { threatLevel: 'low' }), e('b', 37.0001, -122.0001, { threatLevel: 'critical', type: 'vessel' })],
      8,
    );
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(out[0].maxThreat).toBe('critical');
    expect(out[0].types.sort()).toEqual(['drone', 'vessel']);
  });

  it('keeps far apart entities in separate clusters', () => {
    expect(clusterEntities([e('a', 37, -122), e('b', 38, -121)], 8)).toHaveLength(2);
  });

  it('accepts coordinates arrays and drops entities without a position', () => {
    const out = clusterEntities(
      [{ id: 'a', coordinates: [37, -122], type: 'drone' }, { id: 'b', type: 'drone' }],
      16,
    );
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBe(37);
    expect(out[0].maxThreat).toBe('none');
  });

  it('returns an empty array for no entities', () => {
    expect(clusterEntities([], 8)).toEqual([]);
  });

  it('honours a grid override', () => {
    const pair = [e('a', 37, -122), e('b', 37.01, -122)];
    expect(clusterEntities(pair, 8, 100)).toHaveLength(2);
    expect(clusterEntities(pair, 8, 5000)).toHaveLength(1);
  });
});
