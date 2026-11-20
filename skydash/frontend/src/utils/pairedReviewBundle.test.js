import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { SAMPLE_LOG, LOG_VERSION, parseFlightCSV, flightCSVHash } from './flightLog';
import { pairedReviewBundleReport, createPairedReviewBundle, readPairedReviewBundle, MAX_PAIRED_BUNDLE_BYTES, PAIRED_BUNDLE_VERSION } from './pairedReviewBundle';
let snapshot, pair;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  const log = { filename: 'primary.csv', title: 'Primary', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG), id: 'not-portable' };
  const csv_text = '\uFEFF' + SAMPLE_LOG.replaceAll('\n', '\r\n');
  pair = { baseline: { ...log, filename: 'baseline.csv', title: 'Baseline', csv_text, sha256: await flightCSVHash(csv_text), samples: parseFlightCSV(csv_text) }, notes: 'PRIVATE comparison notes', alignment: { primaryIndex: 3, baselineIndex: 2, label: 'Unverified association' } };
  snapshot = { log, review: { title: 'PRIVATE primary title', notes: 'PRIVATE analyst notes' }, debrief: { markers: [{ id: 'marker', time_s: 8, kind: 'Question', text: 'Ask about gap', discussed: true }], notes: 'PRIVATE instructor notes' }, envelope: { profile: { name: 'Criteria', maxAltitude: 30, maxSpeed: null, minBattery: null }, notes: 'PRIVATE envelope notes' } };
});
afterEach(() => vi.unstubAllGlobals());
const data = async () => JSON.parse(await createPairedReviewBundle(snapshot, pair));
describe('two-source paired review bundle', () => {
  it('round-trips exact ordered sources and all listed primary/comparison review sections without trusting cached samples or server identity', async () => {
    snapshot.log.samples = []; pair.baseline.samples = []; const opened = await readPairedReviewBundle(await createPairedReviewBundle(snapshot, pair));
    expect(opened.data.format).toBe(PAIRED_BUNDLE_VERSION); expect(opened.primary.log.csv_text).toBe(SAMPLE_LOG); expect(opened.comparison.baseline.csv_text).toContain('\uFEFF'); expect(opened.comparison.baseline.csv_text).toContain('\r\n'); expect(opened.primary.log.samples).toHaveLength(6); expect(opened.comparison.baseline.samples).toHaveLength(6); expect(opened.primary.data.review).toEqual(snapshot.review); expect(opened.primary.data.debrief.markers).toEqual(snapshot.debrief.markers); expect(opened.primary.data.envelope).toEqual(snapshot.envelope); expect(opened.comparison.notes).toBe(pair.notes); expect(opened.comparison.alignment).toEqual(pair.alignment); expect(opened.primary.log.id).toBeUndefined(); expect(opened.comparison.baseline.id).toBeUndefined(); expect(Object.keys(opened.data).sort()).toEqual(['comparison', 'format', 'primary_case']);
  });
  it('supports identical source bytes without treating them as independent flights and retains nullable criteria/CSV-start alignment', async () => {
    pair.baseline = snapshot.log; pair.alignment = null; snapshot.envelope = null; snapshot.debrief = { markers: [], notes: '' };
    const opened = await readPairedReviewBundle(await createPairedReviewBundle(snapshot, pair)); expect(opened.primary.log.sha256).toBe(opened.comparison.baseline.sha256); expect(opened.comparison.alignment).toBeNull(); expect(opened.primary.data.envelope).toBeNull();
  });
  it.each(['bad', 'null', '[]', '{}', 'x'.repeat(MAX_PAIRED_BUNDLE_BYTES + 1)])('rejects malformed or oversized input', async text => { await expect(readPairedReviewBundle(text)).rejects.toThrow(); });
  it.each([
    x => { x.format = 'future'; }, x => { x.extra = 'unsupported'; }, x => { delete x.comparison; }, x => { x.primary_case.source.sha256 = 'b'.repeat(64); }, x => { x.comparison.primary_sha256 = 'c'.repeat(64); }, x => { x.comparison.baseline.sha256 = 'd'.repeat(64); }, x => { x.comparison.baseline.csv_text = 'bad'; }, x => { x.comparison.alignment.primaryIndex = 500; }, x => { x.primary_case.debrief.markers[0].time_s = 999; }, x => { x.primary_case.envelope.profile.maxAltitude = '30'; }, x => { x.comparison.notes = 'x'.repeat(4001); }, x => { x.comparison.command = 'unsupported'; }, x => { x.primary_case.replay_model = 'future'; }, x => { x.comparison.comparison_model = 'future'; }, x => { x.comparison.baseline = null; },
  ])('validates nested fingerprints, roles, models, bounds and annotations before returning either source', async mutate => { const item = await data(); mutate(item); await expect(readPairedReviewBundle(JSON.stringify(item))).rejects.toThrow(); });
  it('refuses missing pair or metadata that does not match the actual source bytes', async () => { await expect(createPairedReviewBundle(snapshot, null)).rejects.toThrow(); snapshot.log.sha256 = 'b'.repeat(64); await expect(createPairedReviewBundle(snapshot, pair)).rejects.toThrow(); });
});

it('produces an ordered readable handoff with recomputed evidence, included private review sections and explicit artifact/section limits', async () => {
  const text = await createPairedReviewBundle(snapshot, pair), report = await pairedReviewBundleReport(text);
  for (const value of ['READABLE SNAPSHOT ONLY', 'SECTION SCOPES', 'cannot reopen', snapshot.log.sha256, pair.baseline.sha256, 'PRIVATE analyst notes', 'PRIVATE comparison notes', 'PRIVATE instructor notes', 'PRIVATE envelope notes', 'Unverified association', 'MANUAL REVIEW ANCHORS', 'A CSV data row 4', 'B CSV data row 3', 'not better/worse', 'No cursor-specific instantaneous deltas', 'original OEM', 'No automatic upload']) expect(report.toLowerCase()).toContain(value.toLowerCase());
  expect(report.indexOf('=== PRIMARY A')).toBeLessThan(report.indexOf('=== ORDERED A / B'));
  expect(report).not.toContain('not-portable'); expect(report).not.toContain('"csv_text"');
});
it('revalidates both source identities and nested content before producing any readable report', async () => {
  const item = await data(); item.comparison.baseline.sha256 = 'd'.repeat(64); await expect(pairedReviewBundleReport(JSON.stringify(item))).rejects.toThrow(/fingerprint mismatch/);
  item.comparison.baseline.sha256 = pair.baseline.sha256; item.primary_case.envelope.imported_result = 'passed'; await expect(pairedReviewBundleReport(JSON.stringify(item))).rejects.toThrow();
});
it('reports identical sources explicitly and missing optional channels as unknown, never importing cached summaries', async () => {
  pair.baseline = snapshot.log; snapshot.log.samples = [{ altitude_m: 99999 }]; const report = await pairedReviewBundleReport(await createPairedReviewBundle(snapshot, pair)); expect(report).toContain('IDENTICAL SOURCE CHECKSUMS'); expect(report).not.toContain('99999'); expect(report).toContain('Altitude observations: A 5/6, B 5/6');
});
