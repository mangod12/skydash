import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto, createHash } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, parseFlightCSV, flightCSVHash, LOG_VERSION } from './flightLog';
let dir, left, right, note, pair, log;
const hash = data => createHash('sha256').update(data).digest('hex');
const run = (...args) => spawnSync(process.execPath, ['scripts/compare-training-packages.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const success = result => { expect(result.status, result.stderr).toBe(0); for (const secret of ['PRIVATE', '28.6139', '77.209']) expect(result.stdout).not.toContain(secret); return JSON.parse(result.stdout); };
const failure = result => { expect(result.status).toBe(1); expect(result.stdout).toBe(''); for (const secret of ['PRIVATE', '28.6139', '77.209']) expect(result.stderr).not.toContain(secret); };
const entries = () => [{ kind: 'notebook', path: 'PRIVATE-note.json', sha256: hash(note) }, { kind: 'paired', path: 'PRIVATE-pair.json', sha256: hash(pair) }];
const manifest = async (path, bundles = entries(), format = 'skydash-training-intake-manifest-v2') => writeFile(path, JSON.stringify({ format, bundles }));
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-package-compare-')); left = join(dir, 'PRIVATE-left.json'); right = join(dir, 'PRIVATE-right.json');
  log = { filename: 'PRIVATE.csv', title: 'PRIVATE title', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  note = await createNotebookSourceBundle(log, [{ id: 'PRIVATE-copy', first_row: 3, last_row: 5, label: 'PRIVATE label', notes: 'PRIVATE note' }]);
  pair = await createPairedReviewBundle({ log, review: { title: log.title, notes: 'PRIVATE analyst' }, debrief: { markers: [], notes: 'PRIVATE instructor' }, envelope: null }, { baseline: { ...log }, notes: 'PRIVATE comparison', alignment: null });
  await writeFile(join(dir, 'PRIVATE-note.json'), note); await writeFile(join(dir, 'PRIVATE-pair.json'), pair); await manifest(left); await manifest(right);
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('compares complete packages and retains every ordered role occurrence without private data or input writes', async () => {
  const files = await readdir(dir), data = success(run(left, right)); expect(data.exact_manifest_bytes_equal).toBe(true); expect(data.ordered_artifact_sequence_equal).toBe(true); expect(data.artifact_occurrence_inventory_equal).toBe(true); expect(data.source_occurrence_inventory_equal).toBe(true); expect(data.source_groups).toHaveLength(1); expect(data.source_groups[0].left_references).toEqual([{ ordinal: 1, kind: 'notebook', role: 'source' }, { ordinal: 2, kind: 'paired', role: 'primary' }, { ordinal: 2, kind: 'paired', role: 'baseline' }]); expect(data.left.expected_manifest_digest_matched).toBe(false); expect(data).not.toHaveProperty('total_samples'); expect(await readdir(dir)).toEqual(files); expect(await readFile(join(dir, 'PRIVATE-note.json'), 'utf8')).toBe(note);
});
it('distinguishes reordering from occurrence equality and never guesses revision pairs', async () => {
  await manifest(right, entries().reverse()); const data = success(run(left, right)); expect(data.exact_manifest_bytes_equal).toBe(false); expect(data.ordered_artifact_sequence_equal).toBe(false); expect(data.artifact_occurrence_inventory_equal).toBe(true); expect(data.source_occurrence_inventory_equal).toBe(true); expect(data.artifact_groups[0].left_references).toEqual([{ ordinal: 1 }]); expect(data.artifact_groups[0].right_references).toEqual([{ ordinal: 2 }]); expect(data).not.toHaveProperty('pairs');
});
it('ignores path labels, manifest formatting and v1/v2 only in artifact sequence, not whole-manifest equality', async () => {
  await writeFile(join(dir, 'renamed.json'), note); await manifest(right, [{ ...entries()[0], path: 'renamed.json' }, entries()[1]], 'skydash-training-intake-manifest-v1'); await writeFile(right, (await readFile(right, 'utf8')) + '\n'); const data = success(run(left, right)); expect(data.exact_manifest_bytes_equal).toBe(false); expect(data.ordered_artifact_sequence_equal).toBe(true); expect(data.left.manifest_receipt_format).not.toBe(data.right.manifest_receipt_format);
});
it('distinguishes different complete review artifacts with identical exact CSV source bytes', async () => {
  const alternate = note + '\n'; await writeFile(join(dir, 'alternate.json'), alternate); await manifest(right, [{ ...entries()[0], path: 'alternate.json', sha256: hash(alternate) }, entries()[1]]); const data = success(run(left, right)); expect(data.artifact_occurrence_inventory_equal).toBe(false); expect(data.source_occurrence_inventory_equal).toBe(true); expect(data.artifact_groups).toHaveLength(3); expect(data.artifact_groups[0].right_references).toEqual([]); expect(data.artifact_groups[2].left_references).toEqual([]);
});
it('preserves repetition multiplicities rather than collapsing identical artifacts or identical A/B sources', async () => {
  await writeFile(join(dir, 'copy.json'), note); await manifest(right, [...entries(), { ...entries()[0], path: 'copy.json' }]); const data = success(run(left, right)); expect(data.artifact_occurrence_inventory_equal).toBe(false); expect(data.source_occurrence_inventory_equal).toBe(false); expect(data.artifact_groups[0].right_references).toEqual([{ ordinal: 1 }, { ordinal: 3 }]); expect(data.source_groups[0].right_references).toHaveLength(4);
});
it('pins each complete raw manifest independently, accepts uppercase and marks only supplied sides checked', async () => {
  const lh = hash(await readFile(left)), rh = hash(await readFile(right)); let data = success(run(left, right, '--expect-left-sha256', lh.toUpperCase())); expect(data.left.expected_manifest_digest_matched).toBe(true); expect(data.right.expected_manifest_digest_matched).toBe(false); data = success(run(left, right, '--expect-left-sha256', lh, '--expect-right-sha256', rh)); expect(data.right.expected_manifest_digest_matched).toBe(true); await writeFile(right, (await readFile(right, 'utf8')) + '\n'); failure(run(left, right, '--expect-right-sha256', rh));
});
it.each(['left', 'right'].flatMap(side => ['malformed', 'utf8', 'oversize', 'pin', 'kind'].map(kind => [side, kind])))('rejects %s %s original without printing partial results', async (side, kind) => {
  const path = side === 'left' ? left : right;
  const payloads = { malformed: 'PRIVATE malformed', utf8: Buffer.from([0xff]), oversize: 'x'.repeat(65537), pin: JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: [{ ...entries()[0], sha256: 'b'.repeat(64) }] }), kind: JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: [{ ...entries()[0], kind: 'case' }] }) };
  await writeFile(path, payloads[kind]); failure(run(left, right));
});
it('applies canonical folder containment, unique aliases and nested original validation on the right side', async () => {
  await symlink(join(dir, 'PRIVATE-note.json'), join(dir, 'alias.json')); await manifest(right, [entries()[0], { ...entries()[0], path: 'alias.json' }]); failure(run(left, right)); await manifest(right, [{ ...entries()[0], path: '../PRIVATE-note.json' }]); failure(run(left, right)); const raw = JSON.parse(note); raw.notebook.windows[0].last_row = 9999; const invalid = JSON.stringify(raw); await writeFile(join(dir, 'bad.json'), invalid); await manifest(right, [{ ...entries()[0], path: 'bad.json', sha256: hash(invalid) }]); failure(run(left, right));
});
it('resolves each manifest folder separately and does not require matching paths', async () => {
  const other = join(dir, 'other'); await mkdir(other); await writeFile(join(other, 'different.json'), note); await manifest(left, [entries()[0]]); const path = join(other, 'manifest.json'); await manifest(path, [{ ...entries()[0], path: 'different.json' }]); const data = success(run(left, path)); expect(data.ordered_artifact_sequence_equal).toBe(true);
});
it('supports actual case artifacts through explicit v2 and retains case source roles', async () => {
  const text = await createReviewCase(log, { title: 'PRIVATE case', notes: '' }, { markers: [], notes: '' }, null); await writeFile(join(dir, 'case.json'), text); const bundle = [{ kind: 'case', path: 'case.json', sha256: hash(text) }]; await manifest(left, bundle); await manifest(right, bundle); const data = success(run(left, right)); expect(data.source_groups[0].left_references).toEqual([{ ordinal: 1, kind: 'case', role: 'source' }]); await manifest(right, bundle, 'skydash-training-intake-manifest-v1'); failure(run(left, right));
});
it('retains different exact sources and roles rather than treating changed readings as review-only changes', async () => {
  const csv = SAMPLE_LOG.replace('28.6139', '28.6140'), baseline = { ...log, csv_text: csv, sha256: await flightCSVHash(csv), samples: parseFlightCSV(csv) };
  expect(baseline.sha256).not.toBe(log.sha256);
  const bytes = await createPairedReviewBundle({ log, review: { title: log.title, notes: '' }, debrief: { markers: [], notes: '' }, envelope: null }, { baseline, notes: '', alignment: null });
  await writeFile(join(dir, 'different-pair.json'), bytes); await manifest(right, [entries()[0], { kind: 'paired', path: 'different-pair.json', sha256: hash(bytes) }]);
  const data = success(run(left, right)); expect(data.source_occurrence_inventory_equal).toBe(false); expect(data.source_groups).toHaveLength(2); expect(data.source_groups[1].left_references).toEqual([]); expect(data.source_groups[1].right_references).toEqual([{ ordinal: 2, kind: 'paired', role: 'baseline' }]);
});
it('rejects malformed CLI options, duplicates, missing originals and directories', () => {
  expect(run('--help').status).toBe(0); for (const args of [[], [left], [left, right, '--bad', 'x'], [left, right, '--expect-left-sha256', 'bad'], [left, right, '--expect-right-sha256'], [left, right, '--expect-right-sha256', 'a'.repeat(64), '--expect-right-sha256', 'a'.repeat(64)], [dir, right], [left, join(dir, 'missing')]]) failure(run(...args));
});
