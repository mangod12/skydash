import { describe, expect, it } from 'vitest';
import { LOG_VERSION } from './flightLog';
import { RANK_VERSION } from './recordedChannelRanks';
import { PAIR_RANK_VERSION, twoSourceRanks, twoSourceRankReport } from './twoSourceRanks';
const source = (values, hash = 'a', times = null) => ({ model_version: LOG_VERSION, sha256: hash.repeat(64), filename: 'PRIVATE_FILENAME.csv', notes: 'PRIVATE_NOTES', samples: values.map((value, index) => ({ time_s: times?.[index] ?? index * 2, latitude: 28.123, longitude: 77.123, altitude_m: value, ground_speed_m_s: value === null ? null : 0, battery_pct: null })) });
const a = source([40, 10, null, 30, 20], 'a', [0, 2, 4, 12, 14]), b = source([100, 0, 90, 10], 'b', [0, 1, 2, 3]);
const anchor = { primaryIndex: 3, baselineIndex: 2, label: 'PRIVATE_ANCHOR' };
describe('two independent source known-cell ranks', () => {
  it('uses independent known counts, exact rows and nearest rank, no cross-source differences or common-time crop', () => {
    const data = twoSourceRanks(a, b, 'altitude_m'); expect(data.a.knownCount).toBe(4); expect(data.b.knownCount).toBe(4); expect(data.a.count).toBe(5); expect(data.b.count).toBe(4); expect(data.a.points[2]).toMatchObject({ value: 20, row: 5, time: 14, rank: 2, reviewS: 14 }); expect(data.b.points[2]).toMatchObject({ value: 10, row: 4, time: 3, rank: 2, reviewS: 3 }); expect(data).not.toHaveProperty('deltas'); expect(data.a.points[3].gapBefore).toBe(true); expect(data.a.rows.map(row => row.row)).toEqual([2, 5, 4, 1]);
  });
  it('maps exact source seek clocks including negative times, leaving ranks invariant under manual anchors', () => {
    const plain = twoSourceRanks(a, b, 'altitude_m'), data = twoSourceRanks(a, b, 'altitude_m', anchor); expect(data.a.points[0].reviewS).toBe(-10); expect(data.b.points[0].reviewS).toBe(-1); expect(data.a.points[2].reviewS).toBe(2); expect(data.b.points[2].reviewS).toBe(1); for (const side of ['a', 'b']) expect(data[side].points.map(({ reviewS: _reviewS, ...point }) => point)).toEqual(plain[side].points.map(({ reviewS: _reviewS, ...point }) => point)); expect(data.anchor).not.toHaveProperty('label');
  });
  it('zero known cells on only one side is unavailable, not zero or copied from counterpart', () => {
    const data = twoSourceRanks(a, source([null, null], 'b'), 'altitude_m'); expect(data.b.points.every(point => point.rank === null && point.reviewS === null && point.value === null)).toBe(true); expect(data.a.points[0].value).toBe(10); expect(data.b.missingCount).toBe(2);
  });
  it('both allmissing stays unavailable and both knownzero stays known, with tied last-row maxima', () => {
    const empty = twoSourceRanks(a, b, 'battery_pct'); expect(empty.a.knownCount).toBe(0); expect(empty.b.knownCount).toBe(0); const zero = twoSourceRanks(a, b, 'ground_speed_m_s'); expect(zero.a.points.map(point => point.value)).toEqual([0, 0, 0, 0, 0]); expect(zero.b.points[4].row).toBe(4); expect(zero.a.missing.map(row => row.row)).toEqual([3]);
  });
  it('different sample counts select separate ranks, not zipped rows or equal-time events', () => {
    const data = twoSourceRanks(source([5, 4, 3, 2, 1], 'a'), source([100, 10], 'b'), 'altitude_m'); expect(data.a.points[2]).toMatchObject({ rank: 3, row: 3, value: 3 }); expect(data.b.points[2]).toMatchObject({ rank: 1, row: 2, value: 10 });
  });
  it('identical fingerprints warn even when treated as two slots, no independent-flight claim', () => { expect(twoSourceRanks(a, { ...a }, 'altitude_m').identical).toBe(true); expect(twoSourceRankReport(a, { ...a }, 'altitude_m')).toContain('IDENTICAL SOURCE CHECKSUMS: same source bytes'); expect(twoSourceRanks(a, b, 'altitude_m').identical).toBe(false); });
  it('refuses unsupported models/channels or invalid anchors', () => { expect(() => twoSourceRanks({ ...a, model_version: 'future' }, b, 'altitude_m')).toThrow(); expect(() => twoSourceRanks(a, b, 'latitude')).toThrow(); expect(() => twoSourceRanks(a, b, 'altitude_m', { ...anchor, primaryIndex: 99 })).toThrow(); expect(() => twoSourceRanks(a, b, 'altitude_m', { ...anchor, label: '' })).toThrow(); });
  it('report includes two full ledgers, original spacing/missing, model IDs and seek mapping without private text or coordinates', () => {
    const text = twoSourceRankReport(a, b, 'altitude_m', anchor); for (const expected of [PAIR_RANK_VERSION, RANK_VERSION, LOG_VERSION, a.sha256, b.sha256, 'A row 4 at 12s; B row 3 at 2s', 'comparison review clock -10s', 'Rank 4/4: 40 m; original row 1', 'Rank 4/4: 100 m; original row 1', 'Original row 3 at 4s: unknown', 'previous original spacing 8s / gap over 5s', 'not shared review-clock overlap', 'not the arithmetic median']) expect(text).toContain(expected); for (const excluded of ['PRIVATE_FILENAME', 'PRIVATE_NOTES', 'PRIVATE_ANCHOR', '28.123', '77.123', 'latitude', 'longitude', 'csv_text']) expect(text).not.toContain(excluded);
  });
  it('does not mutate either source or anchors and supports both10000row sources', () => {
    const left = source(Array.from({ length: 10000 }, (_, i) => i % 2 ? null : i)), right = source(Array.from({ length: 10000 }, (_, i) => i), 'b'), before = JSON.stringify([left, right, anchor]); const data = twoSourceRanks(left, right, 'altitude_m', anchor); expect(data.a.knownCount).toBe(5000); expect(data.b.knownCount).toBe(10000); data.a.points[0].value = 123456; expect(JSON.stringify([left, right, anchor])).toBe(before); const text = twoSourceRankReport(left, right, 'altitude_m'); expect(text).toContain('Rank 10000/10000: 9999 m; original row 10000'); expect(text).toContain('Original row 10000 at 19998s: unknown');
  });
});
