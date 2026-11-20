import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, symlink, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto, createHash } from 'node:crypto';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, parseFlightCSV, flightCSVHash, LOG_VERSION } from './flightLog';
let dir, manifest, text, data;
const digest = text => createHash('sha256').update(text).digest('hex');
const run = (...args) => spawnSync(process.execPath, ['scripts/verify-paired-manifest.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const save = async () => writeFile(manifest, JSON.stringify(data));
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-intake-')); manifest = join(dir, 'manifest.json');
  const log = { filename: 'PRIVATE.csv', title: 'PRIVATE title', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  text = await createPairedReviewBundle({ log, review: { title: log.title, notes: 'PRIVATE notes' }, debrief: { markers: [], notes: '' }, envelope: null }, { baseline: log, notes: 'PRIVATE baseline notes', alignment: null });
  await mkdir(join(dir, 'session')); await writeFile(join(dir, 'a.json'), text); await writeFile(join(dir, 'session', 'b.json'), text + '\n');
  data = { format: 'skydash-paired-intake-manifest-v1', bundles: [{ path: 'a.json', sha256: digest(text) }, { path: 'session/b.json', sha256: digest(text + '\n') }] }; await save();
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('validates every explicit entry in manifest order and prints no filenames, coordinates or notes, without writes', async () => {
  const before = await readdir(dir), result = run(manifest); expect(result.status).toBe(0); const receipt = JSON.parse(result.stdout); expect(receipt.bundle_count).toBe(2); expect(receipt.exact_manifest_sha256).toBe(digest(JSON.stringify(data))); expect(receipt.receipts.map(x => x.ordinal)).toEqual([1, 2]); expect(receipt.receipts[1].receipt.exact_bundle_sha256).toBe(digest(text + '\n')); for (const value of ['PRIVATE', 'a.json', 'session/b.json', '28.6139']) expect(result.stdout).not.toContain(value); expect(await readdir(dir)).toEqual(before); expect(await readFile(join(dir, 'a.json'), 'utf8')).toBe(text);
});
it('issues no partial success receipt when any later expected digest or nested bundle is invalid', async () => {
  data.bundles[1].sha256 = 'b'.repeat(64); await save(); let result = run(manifest); expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain('PRIVATE');
  const bad = JSON.parse(text); bad.primary_case.source.sha256 = 'c'.repeat(64); const corrupt = JSON.stringify(bad); await writeFile(join(dir,'session','b.json'),corrupt); data.bundles[1].sha256 = digest(corrupt); await save(); result = run(manifest); expect(result.status).toBe(1); expect(result.stdout).toBe('');
});
it('rejects traversal, absolute paths, outside-folder symlinks, duplicate canonical files and directory entries', async () => {
  for (const path of ['../a.json', '/tmp/a.json', './a.json', 'session//b.json', 'session\\b.json', 'session']) { data.bundles[1].path = path; await save(); expect(run(manifest).status).toBe(1); }
  data.bundles[1].path = 'a.json'; await save(); expect(run(manifest).status).toBe(1);
  await symlink(join(dir, 'a.json'),join(dir,'alias.json')); data.bundles[1].path = 'alias.json'; await save(); expect(run(manifest).status).toBe(1);
  await symlink(tmpdir(),join(dir,'outside')); data.bundles[1].path = 'outside'; await save(); expect(run(manifest).status).toBe(1);
});
it('rejects unsupported manifest/entry fields, empty or oversized batch and malformed digests', async () => {
  for (const value of [{}, { ...data, extra: true }, { ...data, format: 'future' }, { ...data, bundles: [] }, { ...data, bundles: Array(21).fill(data.bundles[0]) }, { ...data, bundles: [{ ...data.bundles[0], extra: 'PRIVATE' }] }, { ...data, bundles: [{ path: 'a.json', sha256: 'bad' }] }]) { await writeFile(manifest, JSON.stringify(value)); const result = run(manifest); expect(result.status).toBe(1); expect(result.stdout).toBe(''); }
});
it('enforces input-file, individual bundle and aggregate byte limits before parsing bundle contents', async () => {
  await writeFile(join(dir,'a.json'),'x'.repeat(4*1024*1024+1)); expect(run(manifest).status).toBe(1);
  const paths = [];
  for (let index=0; index<6; index++) { const path = `large-${index}.json`; await writeFile(join(dir,path),'x'.repeat(4*1024*1024)); paths.push({path,sha256:'a'.repeat(64)}); }
  data.bundles=paths; await save(); expect(run(manifest).status).toBe(1);
  await writeFile(manifest,'x'.repeat(64*1024+1)); expect(run(manifest).status).toBe(1); await writeFile(manifest,Buffer.from([0xff])); expect(run(manifest).status).toBe(1); expect(run(dir).status).toBe(1);
});
it('prints bounded help and rejects missing or extra arguments without reading a bundle', () => { expect(run('--help').status).toBe(0); expect(run().status).toBe(1); expect(run(manifest,'extra').status).toBe(1); });
