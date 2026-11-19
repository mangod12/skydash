import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { jointChannelEvidence, jointRuns, jointEvidenceReport } from './jointChannelEvidence';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const all = ['altitude_m', 'ground_speed_m_s', 'battery_pct'];
const custom = samples => ({ ...log, samples: samples.map(([time_s, altitude_m, ground_speed_m_s, battery_pct]) => ({ time_s, altitude_m, ground_speed_m_s, battery_pct, latitude: 28, longitude: 77 })) });
describe('joint channel original-row evidence', () => {
  it('groups co-occurring missing patterns and splits at source gaps without inferred coverage', () => {
    const data = jointChannelEvidence(log, all); expect(data.present).toBe(5); expect(data.missing).toBe(1); expect(data.runs.map(run => [run.first, run.last, run.count, run.missing, run.startsAfterGap])).toEqual([[1, 3, 3, [], false], [4, 4, 1, ['altitude_m', 'battery_pct'], true], [5, 6, 2, [], false]]);
    expect(data.runs[1].precedingSpacing).toBe(8); expect(data.runs[1].start).toBe(12); expect(data.runs[1].end).toBe(12);
  });
  it('splits identical present patterns at over5s but includes exactly5s and ignores numeric value changes', () => {
    const data = jointChannelEvidence(custom([[0, 0, 0, 0], [5, 20, 2, 10], [10.01, 30, 4, 20], [11, 0, 0, 0]]), all); expect(data.runs.map(run => [run.first, run.last, run.startsAfterGap])).toEqual([[1, 2, false], [3, 4, true]]); expect(data.present).toBe(4);
  });
  it('ignores unselected missing cells and normalizes channel order without mutating input', () => {
    const before = JSON.stringify(log), keys = ['battery_pct', 'altitude_m']; const data = jointChannelEvidence(log, keys); expect(data.channels.map(channel => channel.key)).toEqual(['altitude_m', 'battery_pct']); expect(keys).toEqual(['battery_pct', 'altitude_m']); expect(JSON.stringify(log)).toBe(before);
    const speed = jointChannelEvidence(log, ['ground_speed_m_s']); expect(speed.present).toBe(6); expect(speed.runs.map(run => [run.first, run.last])).toEqual([[1, 3], [4, 6]]);
  });
  it('keeps distinct missing patterns even when every row has at least one missing channel', () => {
    const data = jointChannelEvidence(custom([[0, null, 0, 0], [1, null, 0, 0], [2, 0, 0, null], [3, null, 0, null]]), all); expect(data.present).toBe(0); expect(data.runs.map(run => run.count)).toEqual([2, 1, 1]); expect(jointRuns(data, 'present')).toEqual([]); expect(jointRuns(data, 'missing')).toHaveLength(3);
  });
  it('preserves original-row spacing after filters, zero single-row span and missing-at-start/end', () => {
    const data = jointChannelEvidence(custom([[0, null, null, null], [1, 0, 0, 0], [9, null, null, null]]), all); const runs = jointRuns(data, 'missing'); expect(runs.map(run => run.first)).toEqual([1, 3]); expect(runs[1].precedingSpacing).toBe(8); expect(runs[1].end - runs[1].start).toBe(0); expect(runs[0].precedingSpacing).toBeNull();
  });
  it.each([[], ['other'], ['altitude_m', 'altitude_m'], null, 'altitude_m', [...all, 'other']].map(value => [value]))('rejects invalid channel selection %j', selected => expect(() => jointChannelEvidence(log, selected)).toThrow('Select'));
  it('rejects unsupported source/filter and reports all matching runs not just visible pages', () => {
    expect(() => jointChannelEvidence({ ...log, model_version: 'future' }, all)).toThrow('supported'); expect(() => jointChannelEvidence({ ...log, samples: [] }, all)).toThrow('supported'); expect(() => jointRuns(jointChannelEvidence(log, all), 'future')).toThrow('filter');
    const many = custom(Array.from({ length: 40 }, (_, i) => [i, i % 2 ? 0 : null, 0, 0])); const text = jointEvidenceReport(many, all, 'missing'); expect(text).toContain('20/40 matching runs'); expect(text).toContain('Original rows 39 to 39'); expect(text).not.toContain('Original rows 40 to 40');
  });
  it('reports exact source/criteria/gap/empty category without coordinates, channel values or misleading durations', () => {
    const text = jointEvidenceReport(log, all, 'missing'); for (const expected of [log.sha256, 'Source altitude, Ground speed, Battery', 'Original rows 4 to 4', '8s / gap over 5s', 'first-to-last timestamp span 0s, not observed duration', 'Missing selected cells: Source altitude, Battery', 'never continuous time', 'not verified accuracy']) expect(text).toContain(expected);
    expect(text).not.toContain('28.614'); expect(text).not.toContain('77.209'); expect(text).not.toContain('5m/s'); expect(jointEvidenceReport(log, ['ground_speed_m_s'], 'missing')).toContain('No matching runs');
  });
  it('handles10000 alternating rows linearly with exact coverage of row groups', () => { const source = custom(Array.from({ length: 10000 }, (_, i) => [i, i % 2 ? null : 0, 0, 0])); const data = jointChannelEvidence(source, all); expect(data.runs).toHaveLength(10000); expect(data.runs.reduce((sum, run) => sum + run.count, 0)).toBe(10000); expect(data.present).toBe(5000); expect(data.runs.at(-1).last).toBe(10000); });
});
