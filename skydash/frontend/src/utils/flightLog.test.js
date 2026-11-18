import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOG_HEADER, LOG_VERSION, MAX_LOG_BYTES, SAMPLE_LOG, parseFlightCSV, sampleIndexAt, summarizeFlight, flightAfterAction, flightCSVHash } from './flightLog';
const csv = (...rows) => [LOG_HEADER, ...rows].join('\n');
const basic = csv('0,0,0,,,', '2,0,0,0,0,0');
describe('bounded numeric flight CSV contract', () => {
  it('keeps the downloadable synthetic CSV template on the same schema', () => { expect(readFileSync(new URL('../../../../examples/flight-log-training.csv', import.meta.url), 'utf8')).toBe(SAMPLE_LOG); });
  it('preserves genuine zeros and missing optional readings separately', () => {
    const data = parseFlightCSV(basic); expect(data[0].latitude).toBe(0); expect(data[0].altitude_m).toBeNull();
    expect(data[1].altitude_m).toBe(0); expect(data[1].battery_pct).toBe(0);
  });
  it('accepts CRLF, a UTF-8 BOM and numeric exponent forms', () => {
    expect(parseFlightCSV(`\uFEFF${csv('0,+0,-0,1e1,2.5,100', '1,.1,-.1,,,')}\r\n`.replaceAll('\n', '\r\n'))).toHaveLength(2);
  });
  it.each([
    ['', 'header'], ['ULog binary', 'header'], [csv('0,0,0,,,'), '2 to 10,000'],
    [csv('0,0,0,,,', '', '1,0,0,,,'), 'six numeric'],
    [csv('0,0,0,,', '1,0,0,,,'), 'six numeric'],
    [csv('0,,0,,,', '1,0,0,,,'), 'latitude'],
    [csv('0,0,0,,,', '1,NaN,0,,,'), 'latitude'],
    [csv('0,0,0,,,', '1,85.1,0,,,'), 'latitude'],
    [csv('0,0,0,,,', '1,0,181,,,'), 'longitude'],
    [csv('0,0,0,,,', '1,0,0,1e999,,'), 'altitude_m'],
    [csv('0,0,0,,,', '1,0,0,,-1,'), 'ground_speed'],
    [csv('0,0,0,,,', '1,0,0,,,101'), 'battery_pct'],
    [csv('0,0,0,,,', '1,0,0,,,0x10'), 'battery_pct'],
    [csv('0,0,0,,,', '1,0,0,,,"50"'), 'battery_pct'],
    [csv('0,0,0,,,', '21601,0,0,,,'), 'time_s'],
    [csv('1,0,0,,,', '2,0,0,,,'), 'First time_s'],
    [csv('0,0,0,,,', '0,0,0,,,'), 'strictly increase'],
    [csv('0,0,0,,,', '2,0,0,,,', '1,0,0,,,'), 'strictly increase'],
    [csv('0,0,179,,,', '1,0,-179,,,'), 'dateline'],
  ])('rejects invalid source without silent repairs: %s', (text, message) => expect(() => parseFlightCSV(text)).toThrow(message));
  it('caps input bytes and row count', () => {
    expect(() => parseFlightCSV('x'.repeat(MAX_LOG_BYTES + 1))).toThrow('1MiB');
    expect(() => parseFlightCSV(csv(...Array.from({ length: 10001 }, (_, i) => `${i},0,0,,,`)))).toThrow('10,000');
  });
});
describe('reproducible recorded replay and debrief', () => {
  it('holds exact observations rather than interpolating through a gap', () => {
    const data = parseFlightCSV(SAMPLE_LOG); expect(sampleIndexAt(data, 0)).toBe(0); expect(sampleIndexAt(data, 4)).toBe(2);
    expect(sampleIndexAt(data, 11.9)).toBe(2); expect(sampleIndexAt(data, 12)).toBe(3); expect(sampleIndexAt(data, 200)).toBe(5);
  });
  it('splits gaps and excludes their distance without inferring a flown route', () => {
    const data = parseFlightCSV(SAMPLE_LOG), summary = summarizeFlight(data);
    expect(summary.count).toBe(6); expect(summary.durationS).toBe(16); expect(summary.gapCount).toBe(1); expect(summary.largestGapS).toBe(8);
    expect(summary.segments.map(segment => segment.length)).toEqual([3, 3]); expect(summary.distanceM).toBeGreaterThan(50); expect(summary.distanceM).toBeLessThan(65);
    expect(summary.maxAltitudeM).toBe(35); expect(summary.altitudeCount).toBe(5); expect(summary.maxSpeedMps).toBe(6); expect(summary.minBatteryPct).toBe(90);
  });
  it('reports unknowns when optional channels are missing throughout', () => {
    const data = parseFlightCSV(csv('0,0,0,,,', '5,0,0,,,')), summary = summarizeFlight(data);
    expect(summary.gapCount).toBe(0); expect(summary.distanceM).toBe(0); expect(summary.maxAltitudeM).toBeNull(); expect(summary.minBatteryPct).toBeNull(); expect(summary.maxSpeedMps).toBeNull();
    const report = flightAfterAction({ title: 'Unknowns', filename: 'x.csv', sha256: 'abc', samples: data });
    expect(report).toContain('unknownm (0/2 observations)'); expect(report).toContain('not saved');
  });
  it('makes the whole-source report independent of playback position with clear evidence and notes', () => {
    const log = { title: 'Training', filename: 'test.csv', sha256: 'abc', samples: parseFlightCSV(SAMPLE_LOG), notes: 'Review gap', id: 'id-1', created_at: '2026-11-18T12:00:00Z' };
    expect(flightAfterAction({ ...log, replayTime: 0 })).toBe(flightAfterAction({ ...log, replayTime: 12 }));
    const report = flightAfterAction(log); for (const token of [LOG_VERSION, 'abc', 'id-1', 'Review gap', 'not a verified aircraft feed', 'ANALYST NOTES']) {
      expect(report).toContain(token);
    }
  });
  it('hashes exact source bytes reproducibly and distinguishes line ending changes', async () => {
    expect(await flightCSVHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await flightCSVHash(basic)).not.toBe(await flightCSVHash(basic + '\n'));
  });
});
