import { describe, expect, it } from 'vitest';
import { LOG_VERSION, LOG_HEADER, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { COMPARISON_VERSION, compareFlights, comparisonReport, recordedObservation } from './flightComparison';
const log = (csv = SAMPLE_LOG, sha256 = 'a') => ({ title: 'Training', filename: 'source.csv', model_version: LOG_VERSION, sha256, csv_text: csv, samples: parseFlightCSV(csv) });
const baseline = log(`${LOG_HEADER}\n0,0,0,5,0,99\n2,0,0,10,3,98\n4,0,0,15,4,97\n6,0,0,20,5,96\n8,0,0,25,4,95\n10,0,0,20,0,94\n`, 'b');
describe('elapsed-time paired recorded observations', () => {
  it('holds the latest sample and exposes age without interpolation', () => {
    const observation = recordedObservation(baseline.samples, 3);
    expect(observation.sample.time_s).toBe(2); expect(observation.ageS).toBe(1); expect(observation.index).toBe(1); expect(observation.state).toBe('observed');
  });
  it('marks gaps only after their left endpoint and before their right endpoint', () => {
    const a = log(); expect(recordedObservation(a.samples, 4).state).toBe('observed'); expect(recordedObservation(a.samples, 4.1).state).toBe('gap');
    expect(recordedObservation(a.samples, 11.9).state).toBe('gap'); expect(recordedObservation(a.samples, 12).state).toBe('observed');
  });
  it('keeps exact source end valid but never holds it beyond the source', () => {
    expect(recordedObservation(baseline.samples, 10).sample.time_s).toBe(10);
    expect(recordedObservation(baseline.samples, 10.1)).toEqual({ state: 'outside', sample: null, ageS: null, index: null });
    expect(recordedObservation(baseline.samples, -1).sample).toBeNull();
  });
  it('aligns by elapsed seconds and suppresses instantaneous deltas in a gap', () => {
    const comparison = compareFlights(log(), baseline, 8);
    expect(comparison.commonDurationS).toBe(10); expect(comparison.maxDurationS).toBe(16);
    expect(comparison.primaryObservation.sample.time_s).toBe(4); expect(comparison.baselineObservation.sample.time_s).toBe(8);
    expect(comparison.currentDeltas).toEqual({ altitude: null, speed: null, battery: null });
  });
  it('suppresses every instantaneous delta beyond the shorter source', () => {
    const comparison = compareFlights(log(), baseline, 12);
    expect(comparison.baselineObservation.state).toBe('outside'); expect(comparison.currentDeltas.speed).toBeNull();
  });
  it('uses signed A minus B differences for known channels with genuine zero intact', () => {
    const comparison = compareFlights(log(), baseline, 0);
    expect(comparison.currentDeltas).toEqual({ altitude: 5, speed: 0, battery: -4 });
    expect(comparison.deltas.durationS).toBe(6); expect(comparison.deltas.maxAltitudeM).toBe(10); expect(comparison.deltas.minBatteryPct).toBe(-4);
  });
  it('does not subtract missing channels or fill them with zero', () => {
    const unknown = log(`${LOG_HEADER}\n0,0,0,,,\n2,0,0,,,\n`, 'u');
    const comparison = compareFlights(unknown, baseline, 0);
    expect(comparison.deltas.maxAltitudeM).toBeNull(); expect(comparison.deltas.maxSpeedMps).toBeNull(); expect(comparison.deltas.minBatteryPct).toBeNull(); expect(comparison.currentDeltas.altitude).toBeNull();
  });
  it('flags identical source fingerprints rather than presenting independent evidence', () => {
    expect(compareFlights(log(), log()).identicalSource).toBe(true);
    expect(compareFlights(log(), baseline).identicalSource).toBe(false);
  });
  it('rejects an unsupported replay model rather than silently mixing versions', () => {
    expect(() => compareFlights({ ...log(), model_version: 'future' }, baseline)).toThrow('supported CSV replay model');
  });
});
describe('reproducible whole-source comparison report', () => {
  it('includes both exact-source fingerprints, model, role, notes and units', () => {
    const report = comparisonReport({ ...log(), sha256: 'hash-a', id: 'record-1' }, { ...baseline, sha256: 'hash-b' }, 'Review only, not a sensor fact');
    for (const text of [COMPARISON_VERSION, LOG_VERSION, 'PRIMARY A', 'BASELINE B', 'hash-a', 'hash-b', 'record-1', 'Review only', 'not UTC', 'not better/worse', 'Altitude observations: A 5/6, B 6/6', 'A 16.00s | B 10.00s | A-B 6.00s', 'not trimmed']) expect(report).toContain(text);
  });
  it('reports missing evidence honestly and warns when the sources are identical', () => {
    const source = log(`${LOG_HEADER}\n0,0,0,,,\n1,0,0,,,\n`);
    const report = comparisonReport(source, source);
    expect(report).toContain('IDENTICAL SOURCE CHECKSUMS'); expect(report).toContain('unknown'); expect(report).toContain('(none)'); expect(report).toContain('session-only');
  });
  it('is deterministic and does not include the current replay cursor', () => {
    expect(comparisonReport({ ...log(), time: 0 }, baseline)).toBe(comparisonReport({ ...log(), time: 8 }, baseline));
  });
});
