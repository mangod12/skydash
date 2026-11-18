import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV, flightCSVHash } from './flightLog';
import { debriefSidecar } from './instructorDebrief';
import { REVIEW_CASE_VERSION, MAX_CASE_BYTES, createReviewCase, readReviewCase, reviewCaseReport } from './reviewCase';
let log;
const review = { title: 'Synthetic exercise review', notes: 'Analyst discussion note' };
const marker = { id: 'one', time_s: 8, kind: 'Question', text: 'Ask about gap', discussed: true };
const envelope = { profile: { name: 'Training criteria', maxAltitude: 30, maxSpeed: null, minBattery: 93 }, notes: 'Thresholds not policy' };
const json = async () => JSON.parse(await createReviewCase(log, review, { markers: [marker], notes: 'Discussion summary' }, envelope));
beforeEach(async () => { vi.stubGlobal('crypto', webcrypto); log = { filename: 'synthetic.csv', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) }; });
describe('single-file review case', () => {
  it('round-trips exact source, analyst/instructor state and evaluated envelope without backend identity', async () => {
    log.id = 'server-id'; log.created_at = 'earlier'; const data = await json(); const opened = await readReviewCase(JSON.stringify(data));
    expect(data.format).toBe(REVIEW_CASE_VERSION); expect(opened.log.csv_text).toBe(SAMPLE_LOG); expect(opened.log.samples).toEqual(log.samples); expect(opened.log.title).toBe(review.title); expect(opened.data.debrief.markers).toEqual([marker]); expect(opened.data.envelope).toEqual(envelope); expect(opened.log.id).toBeUndefined(); expect(opened.data.source.created_at).toBeUndefined(); expect(Object.keys(data)).toEqual(['format', 'replay_model', 'envelope_model', 'source', 'review', 'debrief', 'envelope']);
  });
  it('supports a source-only review without thresholds or annotations', async () => {
    const opened = await readReviewCase(await createReviewCase(log, review, { markers: [], notes: '' }, null)); expect(opened.data.envelope).toBeNull(); expect(opened.data.debrief.markers).toHaveLength(0); expect(reviewCaseReport(opened)).toContain('No evaluated envelope profile included');
  });
  it('recomputes the reading report from exact CSV and local models, preserving gap context and every match', async () => {
    const report = reviewCaseReport(await readReviewCase(JSON.stringify(await json())));
    for (const part of [log.sha256, 'Analyst discussion note', 'Ask about gap', 'DATA GAP', 'sample 3 at 4s', 'Discussion summary', 'Training criteria', 'Sample 5 at 14s: 35m', 'Thresholds not policy', 'EXCLUDED: comparison baseline', 'not accepted as imported report text', 'SKYDASH / SOURCE EVIDENCE INVENTORY', 'skydash-source-evidence-v1']) expect(report).toContain(part);
  });
  it('preserves BOM and CRLF bytes instead of normalizing before checksum verification', async () => {
    const csv_text = '\uFEFF' + SAMPLE_LOG.replaceAll('\n', '\r\n'); log = { ...log, csv_text, sha256: await flightCSVHash(csv_text), samples: parseFlightCSV(csv_text) }; const opened = await readReviewCase(await createReviewCase(log, review, { markers: [], notes: '' }, null)); expect(opened.log.csv_text).toBe(csv_text);
  });
  it.each(['bad', 'null', '[]', '{}', 'x'.repeat(MAX_CASE_BYTES + 1)])('rejects invalid case input', async text => { await expect(readReviewCase(text)).rejects.toThrow(); });
  it.each([
    data => { data.format = 'future'; }, data => { data.replay_model = 'future'; }, data => { data.envelope_model = 'future'; }, data => { data.report = 'invented'; }, data => { delete data.envelope; }, data => { data.source.command = 'unsupported'; }, data => { data.source.sha256 = 'A'.repeat(64); }, data => { data.source.sha256 = 'b'.repeat(64); }, data => { data.source.csv_text += 'bad'; }, data => { data.source.filename = ''; }, data => { data.source.filename = 'x'.repeat(121); }, data => { data.source.csv_text = 'x'.repeat(1048577); }, data => { data.review.notes = 'x'.repeat(4001); }, data => { data.review.title = ' '; }, data => { data.review.id = 'server'; }, data => { data.debrief.source_sha256 = 'b'.repeat(64); }, data => { data.debrief.markers[0].time_s = 17; }, data => { data.debrief.markers[0].discussed = 'yes'; }, data => { data.envelope.profile.maxAltitude = '30'; }, data => { data.envelope.profile.minBattery = 101; }, data => { data.envelope.notes = 'x'.repeat(4001); }, data => { data.envelope.approved = true; }, data => { data.envelope = {}; },
  ])('rejects unsupported fields, bad source identity, annotations and criteria before opening', async mutate => { const data = await json(); mutate(data); await expect(readReviewCase(JSON.stringify(data))).rejects.toThrow(); });
  it('never packages samples that disagree with the exact source fingerprint', async () => { await expect(createReviewCase({ ...log, sha256: 'b'.repeat(64) }, review, { markers: [], notes: '' }, null)).rejects.toThrow('fingerprint'); });
  it('enforces supported replay model and debrief size on creation', async () => { await expect(createReviewCase({ ...log, model_version: 'future' }, review, { markers: [], notes: '' }, null)).rejects.toThrow('supported'); await expect(createReviewCase(log, review, { markers: [], notes: 'x'.repeat(4001) }, null)).rejects.toThrow('4,000'); });
  it('validates the debrief against the imported source, not an unrelated active source', async () => { const data = await json(); const source = { ...log, sha256: 'b'.repeat(64) }; data.debrief = debriefSidecar(source, [], ''); await expect(readReviewCase(JSON.stringify(data))).rejects.toThrow('fingerprint'); });
});
