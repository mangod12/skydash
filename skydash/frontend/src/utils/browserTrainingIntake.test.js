import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserTrainingIntake } from './browserTrainingIntake';
import { renderTrainingIntake } from './trainingIntakeHtml';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash, parseFlightCSV } from './flightLog';
import { reportTrainingIntake } from '../../scripts/report-training-intake.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = (name, text) => { const bytes = Buffer.from(text); return { name, size: bytes.length, arrayBuffer: vi.fn(async () => bytes) }; };
let originals, manifest, files, entries, dir;
const save = (format = 'skydash-training-intake-manifest-v2', bundles = entries) => file('PRIVATE-manifest.json', JSON.stringify({ format, bundles }));
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-browser-intake-'));
  const log = { filename: 'PRIVATE.csv', title: 'PRIVATE <img src="https://invalid.test/leak">', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) }, primary = { log, review: { title: 'PRIVATE', notes: 'PRIVATE analyst' }, debrief: { markers: [], notes: 'PRIVATE instructor' }, envelope: null };
  originals = { case: await createReviewCase(log, primary.review, primary.debrief, null), notebook: await createNotebookSourceBundle(log, [{ id: 'PRIVATE', first_row: 2, last_row: 4, label: 'PRIVATE', notes: 'PRIVATE' }, { id: 'PRIVATE-repeat', first_row: 2, last_row: 4, label: 'PRIVATE', notes: 'PRIVATE' }, { id: 'PRIVATE-one', first_row: 3, last_row: 3, label: 'PRIVATE', notes: '' }]), paired: await createPairedReviewBundle(primary, { baseline: log, notes: 'PRIVATE comparison', alignment: null }) };
  entries = Object.entries(originals).map(([kind, bytes]) => ({ kind, path: 'PRIVATE-'+kind+'.json', sha256: hash(bytes) }));
  files = Object.entries(originals).map(([kind, bytes]) => file('PRIVATE-'+kind+'.json', bytes)); manifest = save();
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('mixed originals render identically to the current CLI, omit private content, preserve ordered reuse and repeated copies without Buffer', async () => {
  const previous = globalThis.Buffer; let result; try { globalThis.Buffer = undefined; result = await browserTrainingIntake(manifest, [...files].reverse(), hash(await manifest.arrayBuffer()).toUpperCase()); } finally { globalThis.Buffer = previous; }
  await writeFile(join(dir, manifest.name), await manifest.arrayBuffer()); for (const f of files) await writeFile(join(dir, f.name), await f.arrayBuffer());
  expect(result.html).toBe(await reportTrainingIntake(join(dir, manifest.name), { expectedSha256: result.digest }));
  for (const text of ['PRIVATE', '28.6139', '77.209', 'invalid.test', '<script', '<img', '<iframe', '<link', '<form']) expect(result.html).not.toContain(text);
  for (const text of ['Bundle 1: case', 'Bundle 2: notebook', 'Bundle 3: paired', 'Bundle 3 baseline', 'Bundle 3 primary', 'Conversion lineage not checked', 'not independent flights', 'Saved-copy evidence', 'Every interval is unsampled', 'caller-supplied expected complete-manifest digest matched']) expect(result.html).toContain(text);
});
it('retains no independent pin status, v1 semantics, exact repeated artifacts and refuses empty notebooks', async () => {
  const repeat = file('PRIVATE-repeat.json', originals.paired); const m = save('skydash-training-intake-manifest-v1', [entries[2], { ...entries[2], path: repeat.name }]);
  const result = await browserTrainingIntake(m, [files[2], repeat]);
  expect(result.html).toContain('Manifest version: 1'); expect(result.html).toContain('No external complete-manifest digest'); expect(result.html).toContain('Bundle 1; Bundle 2'); expect(result.html).not.toContain('No exact complete-artifact hash is repeated');
  await expect(browserTrainingIntake(save('skydash-training-intake-manifest-v1'), files)).rejects.toThrow();
  const notebook = JSON.parse(originals.notebook); notebook.notebook.windows = []; const f = file('empty.json', JSON.stringify(notebook)); await expect(browserTrainingIntake(save(undefined, [{ kind: 'notebook', path: f.name, sha256: hash(await f.arrayBuffer()) }]), [f])).rejects.toThrow('at least one saved window copy');
});
it('pin mismatch fails before artifact reads and wrong kind, receipts, missing/extra/duplicate/path selections never issue partial HTML', async () => {
  await expect(browserTrainingIntake(manifest, files, 'a'.repeat(64))).rejects.toThrow('expectation mismatch'); for (const f of files) expect(f.arrayBuffer).not.toHaveBeenCalled();
  for (const [m, fs] of [[file('receipt.json', '{"format":"skydash-training-intake-receipt-v2"}'), files], [manifest, files.slice(0, 2)], [manifest, [...files, file('extra.json', '{}')]], [manifest, [files[0], files[0], files[2]]], [save(undefined, [{ ...entries[0], path: '../'+files[0].name }]), [files[0]]], [save(undefined, [{ ...entries[0], kind: 'paired' }]), [files[0]]]]) await expect(browserTrainingIntake(m, fs)).rejects.toThrow();
});
it('repins files and raw manifest after initial checks and refuses newly pinned nested-invalid originals', async () => {
  const originalRead = files[2].arrayBuffer; files[2].arrayBuffer = vi.fn().mockImplementationOnce(originalRead).mockResolvedValue(Buffer.from(originals.paired+' ')); await expect(browserTrainingIntake(manifest, files)).rejects.toThrow('Changed artifact');
  files[2] = file(files[2].name, originals.paired); const originalManifestRead = manifest.arrayBuffer; manifest.arrayBuffer = vi.fn().mockImplementationOnce(originalManifestRead).mockResolvedValue(Buffer.from('PRIVATE')); await expect(browserTrainingIntake(manifest, files)).rejects.toThrow('Changed manifest');
  const invalid = JSON.parse(originals.paired); invalid.comparison.baseline.sha256 = 'a'.repeat(64); const changed = file(files[2].name, JSON.stringify(invalid)); await expect(browserTrainingIntake(save(undefined, [entries[0], entries[1], { ...entries[2], sha256: hash(await changed.arrayBuffer()) }]), [files[0], files[1], changed])).rejects.toThrow();
});
it('bounds static output expansion with no Buffer dependency', () => {
  const data = { bundle_count: 0, receipts: [], repeated_sources: Array.from({ length: 85000 }, () => ({ sha256: 'a'.repeat(64), references: [{ ordinal: 1, role: 'source' }] })), repeated_artifacts: [], expected_manifest_digest_matched: false, exact_manifest_sha256: 'a'.repeat(64), format: 'skydash-training-intake-receipt-v2' };
  expect(() => renderTrainingIntake(data)).toThrow('output exceeds bound');
});
