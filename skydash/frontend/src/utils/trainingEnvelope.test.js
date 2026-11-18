import { describe, expect, it } from 'vitest';
import { LOG_HEADER, LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { ENVELOPE_VERSION, validateEnvelope, evaluateEnvelope, envelopeProfileJSON, readEnvelopeProfile, envelopeReport } from './trainingEnvelope';
const log = { filename: 'synthetic.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const profile = { name: 'Instructor exercise criteria', maxAltitude: 30, maxSpeed: 5, minBattery: 93 };
describe('explicit instructor review profiles', () => {
  it('supports disabled channels and genuine zero thresholds without inventing defaults', () => {
    expect(validateEnvelope({ ...profile, maxSpeed: 0, maxAltitude: null, minBattery: null }).maxSpeed).toBe(0);
    expect(validateEnvelope({ ...profile, name: '  Name  ' }).name).toBe('Name');
  });
  it.each([
    { name: '' }, { name: ' ' }, { name: 'a'.repeat(121) }, { maxAltitude: -1001 }, { maxAltitude: 100001 },
    { maxSpeed: -1 }, { maxSpeed: 501 }, { minBattery: -1 }, { minBattery: 101 }, { maxSpeed: '5' }, { maxSpeed: NaN },
    { maxSpeed: Infinity }, { maxSpeed: undefined }, { command: 'return-to-home' }, { maxAltitude: null, maxSpeed: null, minBattery: null },
  ])('rejects invalid criteria: %j', change => expect(() => validateEnvelope({ ...profile, ...change })).toThrow());
  it('rejects null and array profile shapes', () => { for (const value of [null, [], 'profile']) expect(() => validateEnvelope(value)).toThrow(); });
});
describe('recorded-sample evidence, never continuous compliance', () => {
  it('reviews only strict above/below matches, keeps equality unflagged and counts missing evidence', () => {
    const result = evaluateEnvelope(log, profile);
    expect(result.rules[0].matches.map(item => item.time_s)).toEqual([14]);
    expect(result.rules[1].matches.map(item => item.time_s)).toEqual([4]);
    expect(result.rules[2].matches.map(item => item.time_s)).toEqual([14, 16]);
    expect(result.rules[0].known).toBe(5); expect(result.rules[0].missing).toBe(1); expect(result.rules[2].missing).toBe(1);
    expect(result.gaps).toEqual([{ from_s: 4, to_s: 12, interval_s: 8 }]);
  });
  it('keeps zero readings known and does not transform all missing data into no-match', () => {
    const source = { ...log, samples: parseFlightCSV(`${LOG_HEADER}\n0,0,0,0,0,0\n5,0,0,,,\n`) };
    const result = evaluateEnvelope(source, { name: 'Zeros', maxAltitude: 0, maxSpeed: 0, minBattery: 1 });
    expect(result.rules[0].state).toBe('incomplete'); expect(result.rules[0].matches).toHaveLength(0); expect(result.rules[2].matches[0].value).toBe(0); expect(result.gaps).toHaveLength(0);
  });
  it('distinguishes disabled channels, no matching recorded samples and incomplete channels', () => {
    const result = evaluateEnvelope(log, { name: 'Evidence', maxAltitude: null, maxSpeed: 500, minBattery: 0 });
    expect(result.rules.map(rule => rule.state)).toEqual(['disabled', 'no-match', 'incomplete']);
  });
  it('identifies every matching sample without claiming an interval duration', () => {
    const result = evaluateEnvelope(log, { name: 'All speed', maxAltitude: null, maxSpeed: 0, minBattery: null });
    expect(result.rules[1].matches.map(item => item.index)).toEqual([1, 2, 3, 4]);
    expect(result.rules[1].matches.at(-1).time_s).toBe(14); expect(result.duration_s).toBe(16);
  });
  it('rejects an unsupported source model', () => expect(() => evaluateEnvelope({ ...log, model_version: 'future' }, profile)).toThrow('Unsupported'));
});
describe('reusable non-source-bound profile and evidence report', () => {
  it('round-trips criteria alone, with no source, note or policy authority', () => {
    const data = envelopeProfileJSON(profile); expect(readEnvelopeProfile(JSON.stringify(data))).toEqual(profile);
    expect(Object.keys(data)).toEqual(['format', 'profile']); expect(data.format).toBe(ENVELOPE_VERSION);
    expect(data.source_sha256).toBeUndefined();
  });
  it.each(['bad', 'null', '[]', '{}', JSON.stringify({ format: 'future', profile }), JSON.stringify({ ...envelopeProfileJSON(profile), approved: true }), 'x'.repeat(8193)])('rejects invalid imported profile: %s', text => expect(() => readEnvelopeProfile(text)).toThrow());
  it('includes all matches, exact criteria, units, gap/missing counts, source and notes', () => {
    const report = envelopeReport(log, profile, 'Review source datum before drawing conclusions.');
    for (const text of [ENVELOPE_VERSION, LOG_VERSION, log.sha256, profile.name, 'strictly above 30m', '5/6 known, 1 missing', 'Sample 5 at 14s: 35m', 'Sample 6 at 16s: 90%', '4s to 12s (8s', 'Review source datum', 'not manufacturer limits', 'not verified institutional policy']) expect(report).toContain(text);
  });
  it('makes incomplete evidence and disabled checks explicit in export', () => {
    const report = envelopeReport(log, { name: 'Unknown', maxAltitude: 100, maxSpeed: null, minBattery: null });
    expect(report).toContain('missing evidence prevents'); expect(report).toContain('Maximum ground speed: DISABLED'); expect(report).toContain('(none)');
    expect(() => envelopeReport(log, profile, 'x'.repeat(4001))).toThrow('4,000');
  });
});
