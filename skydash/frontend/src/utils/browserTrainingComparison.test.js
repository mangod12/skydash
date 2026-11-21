import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserTrainingComparison } from './browserTrainingComparison';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash, parseFlightCSV } from './flightLog';
import { reportTrainingComparison } from '../../scripts/report-training-comparison.mjs';
import { compareCheckedTrainingPackages } from './trainingPackageComparison';
import { checkBrowserTrainingIntake } from './browserTrainingIntake';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = (name, text) => { const bytes = Buffer.from(text); return { name, size: bytes.length, arrayBuffer: vi.fn(async () => bytes) }; };
let entries, files, dir, raw;
const side = (items = entries, selected = files, expected = '') => ({ manifest: file('PRIVATE-manifest.json', JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: items })), files: selected, expected });
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-browser-compare-'));
  const log = { filename: 'PRIVATE.csv', title: 'PRIVATE', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) }, primary = { log, review: { title: 'PRIVATE', notes: 'PRIVATE analyst' }, debrief: { markers: [], notes: 'PRIVATE instructor' }, envelope: null };
  raw = { case: await createReviewCase(log, primary.review, primary.debrief, null), notebook: await createNotebookSourceBundle(log, [{ id: 'PRIVATE', first_row: 2, last_row: 4, label: 'PRIVATE', notes: 'PRIVATE' }]), paired: await createPairedReviewBundle(primary, { baseline: log, notes: 'PRIVATE comparison', alignment: null }) };
  entries = Object.entries(raw).map(([kind, bytes]) => ({ kind, path: kind+'.json', sha256: hash(bytes) })); files = Object.entries(raw).map(([kind, bytes]) => file(kind+'.json', bytes));
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('validates both mixed sides and produces identical current CLI HTML while preserving role references and independent per-side pin status', async () => {
  const left = side(), right = side([...entries].reverse(), [...files].reverse()); left.expected = hash(await left.manifest.arrayBuffer()).toUpperCase();
  const result = await browserTrainingComparison(left, right);
  for (const [name, value] of [['left', left], ['right', right]]) { await mkdir(join(dir, name)); await writeFile(join(dir, name, value.manifest.name), await value.manifest.arrayBuffer()); for (const f of value.files) await writeFile(join(dir, name, f.name), await f.arrayBuffer()); }
  expect(result.html).toBe(await reportTrainingComparison(join(dir, 'left', left.manifest.name), join(dir, 'right', right.manifest.name), { expectedLeftSha256: left.expected }));
  for (const value of ['PRIVATE','28.6139','77.209','<script','<img','<iframe','<link','<form']) expect(result.html).not.toContain(value);
  for (const value of ['Complete manifest bytes: different','Ordered complete-artifact sequence: different','Complete-artifact occurrence inventory: equal','CSV source occurrence inventory: equal','paired / baseline','paired / primary','No independent complete-manifest expectation supplied for this side.']) expect(result.html).toContain(value);
});
it('same filenames on opposite sides stay independent, changed artifact bytes with equal sources are not paired as edits or missing work', async () => {
  const changed = file('case.json', raw.case+' '), left = side(), right = side([{ ...entries[0], sha256: hash(await changed.arrayBuffer()) }, ...entries.slice(1)], [changed, ...files.slice(1)]);
  const html = (await browserTrainingComparison(left, right)).html; expect(html).toContain('CSV source occurrence inventory: equal'); expect(html).toContain('Complete-artifact occurrence inventory: different'); expect(html).toContain('No exact occurrence on this side.'); expect(html).toContain('not proof of added or deleted work');
});
it('preserves repeated artifact multiplicity, v1/v2 distinction and identical A/B occurrences without Buffer', async () => {
  const copy = file('repeat.json', raw.notebook), left = side(), right = side([...entries, { ...entries[1], path: 'repeat.json' }], [...files, copy]); const previous = globalThis.Buffer; let html; try { globalThis.Buffer = undefined; html = (await browserTrainingComparison(left, right)).html; } finally { globalThis.Buffer = previous; }
  expect(html).toContain('Complete-artifact occurrence inventory: different'); expect(html).toContain('CSV source occurrence inventory: different'); expect(html).toContain('Bundle 4');
  const a = side(entries.slice(1), files.slice(1)), b = side(entries.slice(1), files.slice(1)); b.manifest = file('PRIVATE-manifest.json', JSON.stringify({ format: 'skydash-training-intake-manifest-v1', bundles: entries.slice(1) }));
  const data = compareCheckedTrainingPackages(await checkBrowserTrainingIntake(a.manifest, a.files), await checkBrowserTrainingIntake(b.manifest, b.files)); expect(data.exact_manifest_bytes_equal).toBe(false); expect(data.ordered_artifact_sequence_equal).toBe(true); expect(data.source_groups[0].left_references).toHaveLength(3);
});
it('wrong pin on either side, missing originals or late nested invalidity never yields partial comparison HTML', async () => {
  for (const position of ['left','right']) { const a = side(), b = side(); (position === 'left' ? a : b).expected = 'a'.repeat(64); await expect(browserTrainingComparison(a, b)).rejects.toThrow('expectation mismatch'); }
  await expect(browserTrainingComparison(side(), side(entries, files.slice(1)))).rejects.toThrow();
  const invalid = JSON.parse(raw.paired); invalid.comparison.baseline.sha256 = 'a'.repeat(64); const bad = file('paired.json', JSON.stringify(invalid)); await expect(browserTrainingComparison(side(), side([...entries.slice(0,2), { ...entries[2], sha256: hash(await bad.arrayBuffer()) }], [...files.slice(0,2), bad]))).rejects.toThrow();
});
