import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { DEBRIEF_VERSION, createReviewMarker, validateMarkers, debriefSidecar, readDebriefSidecar, instructorReport } from './instructorDebrief';
const log = { filename: 'synthetic.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const marker = (changes = {}) => ({ id: 'id-1', time_s: 8, kind: 'Question', text: 'Discuss the gap', discussed: false, ...changes });
describe('bounded instructor-authored timeline', () => {
  it('creates source-time markers without inferring a flight event and sorts without mutating', () => {
    expect(createReviewMarker(log, { id: 'new', time_s: 0, kind: 'Observation', text: '  review  ' })).toEqual(marker({ id: 'new', time_s: 0, kind: 'Observation', text: 'review' }));
    const list = [marker(), marker({ id: 'id-2', time_s: 0 })]; expect(validateMarkers(list, 16).map(item => item.time_s)).toEqual([0, 8]); expect(list[0].time_s).toBe(8);
    expect(validateMarkers([marker({ time_s: 16 })], 16)[0].time_s).toBe(16);
  });
  it.each([
    { time_s: -1 }, { time_s: 17 }, { time_s: NaN }, { time_s: '8' }, { kind: 'Detected threat' },
    { text: '' }, { text: ' ' }, { text: 'a'.repeat(1001) }, { id: '' }, { id: 'a'.repeat(81) },
    { discussed: 'yes' }, { status: 'passed' },
  ])('rejects malformed or misleading annotation fields: %j', change => expect(() => validateMarkers([marker(change)], 16)).toThrow());
  it('bounds capacity, rejects duplicate IDs, arrays and null rows', () => {
    expect(() => validateMarkers(Array.from({ length: 101 }, (_, index) => marker({ id: String(index) })), 16)).toThrow('100');
    expect(() => validateMarkers([marker(), marker()], 16)).toThrow('unique');
    for (const value of [null, {}, [null], [[]]]) expect(() => validateMarkers(value, 16)).toThrow();
  });
});
describe('source-bound portable debrief sidecar', () => {
  it('round-trips annotations and summary without CSV or supplied sample evidence', () => {
    const data = debriefSidecar(log, [marker()], 'Discussion summary');
    expect(Object.keys(data)).toEqual(['format', 'replay_model', 'source_sha256', 'markers', 'notes']);
    expect(readDebriefSidecar(JSON.stringify(data), log)).toEqual(data); expect(data).not.toHaveProperty('csv_text');
  });
  it.each([
    { source_sha256: 'b'.repeat(64) }, { format: 'future' }, { replay_model: 'future' }, { notes: 5 }, { notes: 'a'.repeat(4001) },
    { markers: [marker({ time_s: 17 })] }, { injected_samples: [] },
  ])('rejects mismatched or invalid sidecars before replacement: %j', change => {
    expect(() => readDebriefSidecar(JSON.stringify({ ...debriefSidecar(log, [marker()]), ...change }), log)).toThrow();
  });
  it('does not silently accept missing required notes or a different current replay model', () => {
    const data = debriefSidecar(log, []); delete data.notes;
    expect(() => readDebriefSidecar(JSON.stringify(data), log)).toThrow('summary');
    expect(() => readDebriefSidecar(JSON.stringify(debriefSidecar(log, [])), { ...log, model_version: 'future' })).toThrow('unsupported');
  });
  it('never exports an annotation package too large to reopen, including escaped text', () => {
    const rows = Array.from({ length: 100 }, (_, index) => marker({ id: String(index), text: '\u0001'.repeat(1000) }));
    expect(() => debriefSidecar(log, rows)).toThrow('Shorten notes');
  });
  it('bounds file bytes and catches malformed JSON without processing instructions', () => {
    for (const text of ['bad', 'null', '[]', '"text"', 'x'.repeat(262145)]) expect(() => readDebriefSidecar(text, log)).toThrow();
    const data = debriefSidecar(log, [marker({ text: '<script>alert(1)</script>' })]);
    expect(readDebriefSidecar(JSON.stringify(data), log).markers[0].text).toContain('<script>');
  });
});
describe('source-recomputed instructor report', () => {
  it('records cursor versus held gap sample and unknown readings separately from instructor words', () => {
    const report = instructorReport(log, [marker(), marker({ id: 'unknown', time_s: 12, kind: 'Follow-up', discussed: true })], 'Discuss sampling before any conclusion.');
    for (const part of [DEBRIEF_VERSION, LOG_VERSION, log.sha256, '8.000s / Question', 'sample 3 at 4s, age 4.000s / DATA GAP', '12.000s / Follow-up / Discussed', 'altitude unknown', 'Marked discussed: 1', 'not a competence assessment', 'Discuss sampling', 'not tamper-evident']) expect(report).toContain(part);
  });
  it('handles empty reviews and labels zero-time observations correctly', () => {
    expect(instructorReport(log, [])).toContain('Review markers: 0');
    expect(instructorReport(log, [marker({ time_s: 0 })])).toContain('sample 1 at 0s, age 0.000s');
    expect(instructorReport(log, [marker({ time_s: 0 })])).not.toContain(' / DATA GAP');
  });
});
