import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOG_VERSION, LOG_HEADER, SAMPLE_LOG, parseFlightCSV, flightCSVHash } from './flightLog';
import { createComparisonReview, readComparisonReview, MAX_COMPARISON_REVIEW_BYTES } from './comparisonReview';
let primary, baseline;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  const log = async (csv, filename) => ({ csv_text: csv, filename, title: filename, sha256: await flightCSVHash(csv), samples: parseFlightCSV(csv), model_version: LOG_VERSION });
  primary = await log(SAMPLE_LOG, 'primary.csv'); baseline = await log(`${LOG_HEADER}\r\n0,0,0,0,,0\r\n0.03,0,0,,0,\r\n0.13,0,0,2,2,99\r\n`, 'baseline.csv');
});
afterEach(() => vi.unstubAllGlobals());
const anchors = { primaryIndex: 3, baselineIndex: 1, label: 'Discussion point, not same-event evidence' };
const make = () => createComparisonReview(primary, baseline, 'Private comparison notes', anchors);
describe('portable source-bound comparison review', () => {
  it('round-trips exact baseline bytes, title, notes and anchors without embedding primary or results', async () => {
    const contents = await make(), opened = await readComparisonReview(contents, primary);
    expect(opened.baseline.csv_text).toBe(baseline.csv_text); expect(opened.baseline.sha256).toBe(baseline.sha256); expect(opened.alignment).toEqual(anchors); expect(opened.notes).toBe('Private comparison notes');
    expect(contents).not.toContain(primary.csv_text); expect(opened.data.primary_sha256).toBe(primary.sha256); expect(Object.keys(opened.data.baseline)).toEqual(['filename', 'title', 'csv_text', 'sha256']); expect(opened.baseline.samples[1].altitude_m).toBeNull();
  });
  it('keeps default alignment explicit as null and accepts genuine zero anchor indices', async () => {
    expect((await readComparisonReview(await createComparisonReview(primary, baseline), primary)).alignment).toBeNull();
    expect((await readComparisonReview(await createComparisonReview(primary, baseline, '', { ...anchors, primaryIndex: 0, baselineIndex: 0 }), primary)).alignment.primaryIndex).toBe(0);
  });
  it.each(['format','replay_model','comparison_model','alignment_model'])('rejects unsupported %s', async field => {
    const data = JSON.parse(await make()); data[field] = 'future'; await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow('Unsupported');
  });
  it.each(['notes','alignment','primary_sha256','baseline'])('rejects missing required field %s', async field => {
    const data = JSON.parse(await make()); delete data[field]; await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow('Unsupported');
  });
  it('rejects extra top-level, source and alignment fields rather than trusting imported results', async () => {
    for (const mutate of [d => { d.results = 'passed'; }, d => { d.baseline.samples = []; }, d => { d.alignment.result = 'safe'; }]) {
      const data = JSON.parse(await make()); mutate(data); await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow();
    }
  });
  it('requires the exact current primary, not a different source or misleading primary metadata', async () => {
    const contents = await make(); await expect(readComparisonReview(contents, baseline)).rejects.toThrow('Primary fingerprint mismatch');
    await expect(readComparisonReview(contents, { ...primary, csv_text: baseline.csv_text })).rejects.toThrow('Current primary CSV');
  });
  it('rejects tampered baseline bytes even if numeric data still parses', async () => {
    const data = JSON.parse(await make()); data.baseline.csv_text = data.baseline.csv_text.replace('99', '98'); await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow('baseline fingerprint mismatch');
  });
  it('validates baseline CSV rather than trusting a hash or supplied sample objects', async () => {
    const data = JSON.parse(await make()); data.baseline.csv_text = 'bad'; data.baseline.sha256 = await flightCSVHash('bad'); await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow('Expected exact header');
  });
  it.each([{primaryIndex:99},{baselineIndex:-1},{baselineIndex:0.2},{label:''}])('rejects invalid manual anchor %j', async invalid => {
    const data = JSON.parse(await make()); Object.assign(data.alignment, invalid); await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow('existing sample row');
  });
  it('bounds file size, source bytes, notes and metadata', async () => {
    await expect(readComparisonReview('x'.repeat(MAX_COMPARISON_REVIEW_BYTES+1), primary)).rejects.toThrow('2MiB');
    for (const mutate of [d => { d.baseline.csv_text = 'x'.repeat(1024*1024+1); }, d => { d.notes = 'x'.repeat(4001); }, d => { d.notes = null; }, d => { d.baseline.title = ''; }, d => { d.baseline.filename = 'x'.repeat(121); }, d => { d.baseline.sha256 = null; }]) {
      const data = JSON.parse(await make()); mutate(data); await expect(readComparisonReview(JSON.stringify(data), primary)).rejects.toThrow();
    }
  });
  it('rejects malformed or nonobject JSON and unavailable source/model', async () => {
    for (const text of ['bad', 'null', '[]', 'true']) await expect(readComparisonReview(text, primary)).rejects.toThrow();
    await expect(createComparisonReview(null, baseline)).rejects.toThrow('both sources'); await expect(createComparisonReview(primary, { ...baseline, model_version: 'future' })).rejects.toThrow('baseline replay model'); await expect(readComparisonReview(await make(), { ...primary, model_version:'future' })).rejects.toThrow('Unsupported');
  });
});
