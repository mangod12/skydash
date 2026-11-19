import { describe, expect, it } from 'vitest';
import { LOG_VERSION } from './flightLog';
import { recordedChannelRanks, rankedChannelReport } from './recordedChannelRanks';
const log = values => ({ model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: values.map((value, i) => ({ time_s: i * 2, latitude: 28, longitude: 77, altitude_m: value, ground_speed_m_s: value, battery_pct: value })) });
describe('recorded known-cell value ranks', () => {
  it('sorts numeric values then original rows, keeping exact source row/time and original previous spacing', () => {
    const source = log([40, 10, 30, 20]); source.samples[2].time_s = 12; source.samples[3].time_s = 14; const result = recordedChannelRanks(source, 'altitude_m');
    expect(result.rows.map(row => [row.rank, row.row, row.value, row.time, row.spacing])).toEqual([[1, 2, 10, 2, 2], [2, 4, 20, 14, 2], [3, 3, 30, 12, 10], [4, 1, 40, 0, null]]); expect(result.rows[2].gapBefore).toBe(true); expect(result.rows[1].gapBefore).toBe(false); expect(result.rows[0]).not.toHaveProperty('latitude');
  });
  it('nearest rank even P50 selects lower middle, never arithmetic median or interpolated quantile', () => {
    const result = recordedChannelRanks(log([100, 0, 90, 10]), 'altitude_m'); expect(result.points.map(point => [point.label, point.rank, point.value, point.row])).toEqual([['Minimum', 1, 0, 2], ['Nearest-rank P25', 1, 0, 2], ['Nearest-rank P50', 2, 10, 4], ['Nearest-rank P75', 3, 90, 3], ['Maximum', 4, 100, 1]]);
  });
  it.each([1, 2, 3, 5, 7, 10])('uses ceil(p*n) for %s known cells', n => {
    const source = log(Array.from({ length: Math.max(2, n) }, (_, i) => i < n ? i : null)), result = recordedChannelRanks(source, 'battery_pct'); expect(result.points.map(point => point.rank)).toEqual([1, Math.ceil(n * .25), Math.ceil(n * .5), Math.ceil(n * .75), n]);
  });
  it('one known cell can fill every point; zero known cells yields all unavailable, not zero', () => {
    const one = recordedChannelRanks(log([null, 0, null]), 'ground_speed_m_s'); expect(one.points.map(point => point.value)).toEqual([0, 0, 0, 0, 0]); expect(one.points.map(point => point.row)).toEqual([2, 2, 2, 2, 2]); const empty = recordedChannelRanks(log([null, null]), 'altitude_m'); expect(empty.knownCount).toBe(0); expect(empty.points.every(point => point.value === null && point.row === null && point.rank === null)).toBe(true); expect(empty.missing.map(row => row.row)).toEqual([1, 2]);
  });
  it('ties keep original ascending row order, maximum chooses last tied cell and missing is never zero-filled', () => {
    const result = recordedChannelRanks(log([5, null, 0, 5, null, 5]), 'altitude_m'); expect(result.rows.map(row => row.row)).toEqual([3, 1, 4, 6]); expect(result.points[4].row).toBe(6); expect(result.missing.map(row => row.row)).toEqual([2, 5]); expect(result.missingCount).toBe(2); expect(result.knownCount).toBe(4);
  });
  it('unequal spacing/gaps do not time-weight ranks or drop known gap-adjacent cells, exactly5s not a gap', () => {
    const source = log([0, 100, 50]); source.samples[1].time_s = 5; source.samples[2].time_s = 100; const result = recordedChannelRanks(source, 'battery_pct'); expect(result.knownCount).toBe(3); expect(result.points[2].value).toBe(50); expect(result.rows.find(row => row.row === 2).gapBefore).toBe(false); expect(result.rows.find(row => row.row === 3).gapBefore).toBe(true);
  });
  it('negative source altitude sorts numerically without rounding or lexicographic ranking', () => {
    const result = recordedChannelRanks(log([-1.25, 2, -10, 0.1, 0]), 'altitude_m'); expect(result.rows.map(row => row.value)).toEqual([-10, -1.25, 0, .1, 2]);
  });
  it('rejects unsupported source/model/channel and nonfinite or undefined cells', () => {
    for (const source of [null, { ...log([0, 1]), model_version: 'future' }, log([1])]) expect(() => recordedChannelRanks(source, 'altitude_m')).toThrow(); expect(() => recordedChannelRanks(log([0, 1]), 'latitude')).toThrow(); for (const value of [NaN, Infinity, undefined]) expect(() => recordedChannelRanks(log([0, value]), 'altitude_m')).toThrow();
  });
  it('supports10000cells, returns independent data and exports every known/missing cell beyond UI page', () => {
    const source = log(Array.from({ length: 10000 }, (_, i) => i % 2 ? null : i)), before = JSON.stringify(source); const result = recordedChannelRanks(source, 'altitude_m'); expect(result.rows).toHaveLength(5000); expect(result.missing).toHaveLength(5000); result.rows[0].value = 999; expect(JSON.stringify(source)).toBe(before); const text = rankedChannelReport(source, 'altitude_m'); expect(text).toContain('Rank 5000/5000: 9998 m; original row 9999'); expect(text).toContain('Original row 10000 at 19998s: unknown');
  });
  it('report preserves original times/gap/unknown and method, excludes coordinates and notes', () => {
    const source = log([null, 0, 3]); source.samples[2].time_s = 12; const text = rankedChannelReport(source, 'altitude_m'); for (const value of ['rank ceil(p × known count)', 'not the arithmetic median', 'previous original spacing 10s / gap over 5s', 'Original row 1 at 0s: unknown', source.sha256, 'ALL KNOWN CELLS', 'ALL EXCLUDED MISSING CELLS']) expect(text).toContain(value); for (const value of ['latitude', 'longitude', 'csv_text', '28,77']) expect(text).not.toContain(value);
  });
});
