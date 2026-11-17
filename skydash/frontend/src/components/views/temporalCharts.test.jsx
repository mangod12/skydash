import { describe, it, expect, vi, afterEach } from 'vitest';
import { bucketEvents, buildGrid } from '../../utils/eventBuckets';

const NOW = 1800000000000;
const sumBuckets = (buckets) => buckets.reduce((sum, bucket) => sum + bucket.low + bucket.medium + bucket.high + bucket.critical, 0);
const sumGrid = (grid) => grid.flat().reduce((sum, cell) => sum + cell, 0);
afterEach(() => vi.restoreAllMocks());

describe('activity chart input integrity', () => {
  it('rejects missing, coerced, non-finite, out-of-date-range and future times', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const invalid = [null, {}, { time: null }, { time: '' }, { time: false }, { time: `${NOW}` }, { time: NaN }, { time: Infinity }, { time: -9e15 }, { time: NOW + 1 }];
    expect(bucketEvents(invalid)).toEqual([]);
    expect(buildGrid(invalid).colLabels).toEqual([]);
    const events = [...invalid, { time: NOW - 60000, severity: 'critical' }];
    expect(sumBuckets(bucketEvents(events))).toBe(1);
    expect(sumGrid(buildGrid(events).grid)).toBe(1);
  });

  it('keeps boundary events in visible buckets and separates severities', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const events = [{ time: NOW - 60000, severity: 'critical' }, { time: NOW, severity: 'warning' }];
    const buckets = bucketEvents(events);
    expect(buckets[0].critical).toBe(1);
    expect(buckets.at(-1).medium).toBe(1);
    const { grid } = buildGrid(events);
    expect(grid[0][0]).toBe(1);
    expect(grid[1].at(-1)).toBe(1);
  });

  it('does not interpret inherited severity names as bucket or row identifiers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const events = ['constructor', '__proto__', 'toString'].map((severity) => ({ time: NOW, severity, type: severity }));
    expect(sumBuckets(bucketEvents(events))).toBe(3);
    expect(buildGrid(events).grid[3].reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('handles 150k events without exceeding call argument limits', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const events = Array.from({ length: 150000 }, (_, index) => ({ time: NOW - index, severity: 'info' }));
    expect(sumBuckets(bucketEvents(events))).toBe(events.length);
    expect(sumGrid(buildGrid(events).grid)).toBe(events.length);
  });
});
