import { describe, it, expect } from 'vitest';
import { LOG_VERSION, LOG_HEADER, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { QUALITY_VERSION, sourceEvidence, sourceEvidenceReport } from './sourceEvidence';
const log = { filename: 'source.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const source = rows => ({ ...log, samples: parseFlightCSV(`${LOG_HEADER}\n${rows.join('\n')}\n`) });
describe('recorded source evidence inventory', () => {
  it('computes observed intervals, median, buckets and exact gap endpoints', () => {
    const data = sourceEvidence(log); expect(data.count).toBe(6); expect(data.duration_s).toBe(16); expect(data.interval_count).toBe(5); expect(data.min_interval_s).toBe(2); expect(data.median_interval_s).toBe(2); expect(data.max_interval_s).toBe(8); expect(data.buckets.map(bucket => bucket.count)).toEqual([0, 4, 1]); expect(data.gaps).toEqual([{ from_index: 2, to_index: 3, from_s: 4, to_s: 12, interval_s: 8 }]);
  });
  it('distinguishes known zero values from blank cells and groups consecutive missing rows', () => {
    const data = sourceEvidence(source(['0,0,0,0,0,0', '1,0,0,,,', '2,0,0,,,', '3,0,0,0,0,0', '4,0,0,,,']));
    expect(data.channels.map(channel => channel.known)).toEqual([2, 2, 2]); expect(data.channels[0].missing).toBe(3); expect(data.channels[0].runs).toEqual([{ from_index: 1, to_index: 2, from_s: 1, to_s: 2, count: 2 }, { from_index: 4, to_index: 4, from_s: 4, to_s: 4, count: 1 }]);
  });
  it('handles missing channels for the entire source without inventing a completeness score', () => {
    const data = sourceEvidence(source(['0,0,0,,,', '10,0,0,,,'])); expect(data.channels[0].known).toBe(0); expect(data.channels[0].runs).toEqual([{ from_index: 0, to_index: 1, from_s: 0, to_s: 10, count: 2 }]); expect(data.completeness).toBeUndefined(); expect(data.expected_rate).toBeUndefined(); expect(data.lost_samples).toBeUndefined();
  });
  it('uses the mean of the middle two spacings for an even interval count', () => {
    const data = sourceEvidence(source(['0,0,0,1,1,1', '1,0,0,1,1,1', '4,0,0,1,1,1'])); expect(data.median_interval_s).toBe(2);
  });
  it('handles one interval and bucket boundaries with strict over5s gaps', () => {
    expect(sourceEvidence(source(['0,0,0,1,1,1', '5,0,0,1,1,1'])).gaps).toHaveLength(0);
    const data = sourceEvidence(source(['0,0,0,1,1,1', '1,0,0,1,1,1', '6,0,0,1,1,1', '11.1,0,0,1,1,1'])); expect(data.buckets.map(bucket => bucket.count)).toEqual([1, 1, 1]); expect(data.gaps[0].to_s).toBe(11.1);
    expect(sourceEvidence(source(['0,0,0,1,1,1', '0.25,0,0,1,1,1'])).median_interval_s).toBe(0.25);
  });
  it('groups exact repeated coordinates but does not merge different positions or infer motion', () => {
    const data = sourceEvidence(source(['0,0,0,1,1,1', '1,0,0,2,2,2', '2,0,0,3,3,3', '3,0.01,0,1,1,1', '4,0.01,0,1,1,1', '5,0.010000001,0,1,1,1'])); expect(data.repeated).toEqual([{ from_index: 0, to_index: 2, from_s: 0, to_s: 2, count: 3 }, { from_index: 3, to_index: 4, from_s: 3, to_s: 4, count: 2 }]);
  });
  it('does not mutate the source samples', () => { const original = JSON.stringify(log); sourceEvidence(log); sourceEvidenceReport(log); expect(JSON.stringify(log)).toBe(original); });
  it.each([null, { ...log, model_version: 'future' }, { ...log, samples: [] }])('refuses unsupported sources', value => expect(() => sourceEvidence(value)).toThrow('supported'));
  it('scales to every valid row and exports every gap instead of only a display page', () => {
    const data = source(Array.from({ length: 1000 }, (_, index) => `${index * 6},0,0,,,`)); const evidence = sourceEvidence(data); expect(evidence.gaps).toHaveLength(999); expect(evidence.channels[0].runs[0].count).toBe(1000); expect(sourceEvidenceReport(data)).toContain('Rows 999 to 1000: 5988s to 5994s');
  });
  it('exports source identity/model, all counts and gap/missing caveats without coordinates or notes', () => {
    const report = sourceEvidenceReport({ ...log, notes: 'PRIVATE NOTE' }); for (const value of [QUALITY_VERSION, LOG_VERSION, log.sha256, 'minimum 2s; median 2s; maximum 8s', 'Rows 3 to 4: 4s to 12s, 8s', 'Source altitude: 5/6 known, 1 missing', 'Rows 4 to 4, timestamps 12s to 12s: 1 missing', 'not outage duration', 'not a verified expected sensor rate', 'not a lost-sample count']) expect(report).toContain(value); expect(report).not.toContain('28.6139'); expect(report).not.toContain('PRIVATE NOTE');
  });
  it('makes empty categories explicit without claiming a complete source', () => { const report = sourceEvidenceReport(log); expect(report).toContain('(no missing cells in this channel)'); expect(report).toContain('REPEATED CONSECUTIVE COORDINATE ROWS\n(none)'); expect(report).toContain('not reveal the expected logging rate'); });
});
