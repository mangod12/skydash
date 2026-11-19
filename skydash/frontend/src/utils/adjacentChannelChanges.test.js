import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { adjacentChannelChanges, changeRows, adjacentChangeReport } from './adjacentChannelChanges';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const source = values => ({ ...log, samples: values.map(([time_s, value]) => ({ ...log.samples[0], time_s, altitude_m: value, battery_pct: value })) });
describe('adjacent optional-channel arithmetic', () => {
  it('computes later-minus-earlier exact original pairs, excludes missing endpoints and gaps without bridging', () => {
    const data = adjacentChannelChanges(log, 'altitude_m'); expect(data.rows).toHaveLength(5); expect(data.computed).toBe(3); expect(data.unavailable).toBe(2); expect(data.rows.map(row => row.delta)).toEqual([10, 10, null, null, -10]); expect(data.rows.map(row => row.quotient)).toEqual([5, 5, null, null, -5]); expect(data.rows[2].reasons).toEqual(['gap over 5s', 'later cell missing']); expect(data.rows[3].reasons).toEqual(['earlier cell missing']); expect(data.gapCount).toBe(1); expect(data.missingCount).toBe(2);
  });
  it('computes exactly5s but blocks over5s even known identical endpoints and reports all overlapping reasons', () => {
    const data = adjacentChannelChanges(source([[0, 10], [5, 0], [10.001, 0], [16, null], [22, null]]), 'altitude_m'); expect(data.rows[0].delta).toBe(-10); expect(data.rows[0].quotient).toBe(-2); expect(data.rows[1].reasons).toEqual(['gap over 5s']); expect(data.rows[1].delta).toBeNull(); expect(data.rows[3].reasons).toEqual(['gap over 5s', 'earlier cell missing', 'later cell missing']);
  });
  it('zero is known, signed extrema are not magnitudes and equal values keep earliest original pair', () => {
    const data = adjacentChannelChanges(source([[0, 0], [1, 10], [3, 20], [4, 0], [5, 0]]), 'altitude_m'); expect(data.computed).toBe(4); expect(data.maxDelta.first).toBe(1); expect(data.maxDelta.delta).toBe(10); expect(data.minDelta.delta).toBe(-20); expect(data.maxQuotient.first).toBe(1); expect(data.minQuotient.quotient).toBe(-20); expect(data.rows.at(-1).quotient).toBe(0);
  });
  it('difference and quotient extrema can identify different original pairs', () => {
    const data = adjacentChannelChanges(source([[0, 0], [5, 20], [6, 30]]), 'altitude_m'); expect(data.maxDelta.first).toBe(1); expect(data.maxQuotient.first).toBe(2); expect(data.maxQuotient.quotient).toBe(10);
  });
  it('all missing/blocked data has no fake zero extrema and no matching computed rows', () => {
    const data = adjacentChannelChanges(source([[0, null], [8, null], [9, null]]), 'altitude_m'); expect(data.computed).toBe(0); for (const key of ['minDelta', 'maxDelta', 'minQuotient', 'maxQuotient']) expect(data[key]).toBeNull(); expect(changeRows(data, 'computed')).toEqual([]); expect(adjacentChangeReport(source([[0, null], [8, null]]), 'altitude_m', 'computed')).toContain('No matching pairs');
  });
  it('battery deltas are percentage points and selected channels independent', () => {
    const data = adjacentChannelChanges(log, 'battery_pct'); expect(data.rows[0].delta).toBe(-1); expect(data.rows[0].quotient).toBe(-0.5); expect(data.channel.deltaUnit).toBe('percentage points'); expect(adjacentChannelChanges(log, 'ground_speed_m_s').computed).toBe(4);
  });
  it.each(['', 'latitude', 'speed', null])('rejects unsupported channel %j', key => expect(() => adjacentChannelChanges(log, key)).toThrow('channel'));
  it('rejects unsupported source/filter and never mutates source data', () => { expect(() => adjacentChannelChanges({ ...log, model_version: 'future' }, 'altitude_m')).toThrow('supported'); expect(() => adjacentChannelChanges({ ...log, samples: [] }, 'altitude_m')).toThrow('supported'); const before = JSON.stringify(log), data = adjacentChannelChanges(log, 'altitude_m'); expect(() => changeRows(data, 'other')).toThrow('filter'); expect(JSON.stringify(log)).toBe(before); });
  it('filtered reports preserve original pairs/endpoints, global extrema, units/reasons/privacy, no coordinates', () => {
    const text = adjacentChangeReport(log, 'altitude_m', 'unavailable'); for (const expected of [log.sha256, '2/5 matching pairs', 'Original rows 3 to 4', 'Original rows 4 to 5', 'gap over 5s; later cell missing', 'Minimum signed difference: -10 m; original rows 5 to 6', 'not additive', 'not absolute magnitudes', 'unknown has no unit']) expect(text).toContain(expected); expect(text).not.toContain('Original rows 1 to 2;'); expect(text).not.toContain('28.614'); expect(text).not.toContain('unknownm');
  });
  it('retains all matching rows beyond a page and handles10000 samples without skipping pairs', () => { const data = source(Array.from({ length: 10000 }, (_, i) => [i, i])); const result = adjacentChannelChanges(data, 'altitude_m'); expect(result.rows).toHaveLength(9999); expect(result.rows.at(-1).last).toBe(10000); expect(result.maxDelta.first).toBe(1); expect(adjacentChangeReport(data, 'altitude_m', 'computed')).toContain('Original rows 9999 to 10000'); });
});
