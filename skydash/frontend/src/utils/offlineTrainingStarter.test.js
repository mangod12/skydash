import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
let dir, output;
const run = (...args) => spawnSync(process.execPath, ['scripts/create-training-example.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const success = result => { expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout); };
const failure = result => { expect(result.status).toBe(1); expect(result.stdout).toBe(''); };
const verify = (script, ...args) => spawnSync(process.execPath, ['scripts/' + script + '.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'skydash-starter-')); output = join(dir, 'example'); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
it('creates a fixed synthetic-only mixed handoff with current exports, exact pins and reproducible partial native/mapped source coverage', async () => {
  const data = success(run('--output-dir', output)); expect(data.synthetic_only).toBe(true); expect(data.bundle_count).toBe(3); expect(data.archive.archive_file_count).toBe(11); expect(data.archive.conversion_lineage_included).toBe(true); expect(data.archive.exact_archive_sha256).toBe(createHash('sha256').update(await readFile(join(output, 'synthetic-handoff.zip'))).digest('hex')); expect((await stat(output)).mode & 0o777).toBe(0o700);
  const names = await readdir(output); expect(names.sort()).toEqual(['EXAMPLE-GUIDE.txt', 'archive-receipt.json', 'case.json', 'lineage', 'notebook.json', 'paired.json', 'sample.csv', 'synthetic-handoff.zip', 'training.json'].sort()); for (const name of names.filter(name => name !== 'lineage')) expect((await stat(join(output, name))).mode & 0o777).toBe(0o600);
  const training = join(output, 'training.json'), lineage = join(output, 'lineage', 'lineage.json'), receipt = success(verify('verify-training-lineage', training, lineage, '--confirm-wgs84')); expect(receipt.training.bundle_count).toBe(3); expect(receipt.all_review_sources_linked).toBe(false); expect(receipt.review_sources.map(item => [item.kind, item.role, item.matching_conversion_ordinals])).toEqual([['case', 'source', []], ['notebook', 'source', []], ['paired', 'primary', []], ['paired', 'baseline', [1]]]); failure(verify('verify-training-lineage', training, lineage, '--confirm-wgs84', '--require-all-review-sources'));
  for (const file of ['case.json', 'notebook.json', 'paired.json']) expect(await readFile(join(output, file), 'utf8')).toContain('SYNTHETIC'); expect(await readFile(join(output, 'EXAMPLE-GUIDE.txt'), 'utf8')).toContain('not this whole directory'); expect(data.scope).toContain('not independent authenticity'); expect(data).not.toHaveProperty('total_flights');
});
it('repeats exact ZIP bytes deterministically and independently revalidates extracted original manifests with ordinary zipfile CRC checks', async () => {
  const first = success(run('--output-dir', output)), other = join(dir, 'other'); const second = success(run('--output-dir', other)); expect(second.archive.exact_archive_sha256).toBe(first.archive.exact_archive_sha256); expect(await readFile(join(output, 'synthetic-handoff.zip'))).toEqual(await readFile(join(other, 'synthetic-handoff.zip')));
  const extracted = join(dir, 'unpacked'), python = spawnSync('python3', ['-c', "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;z.extractall(sys.argv[2]);assert b'SYNTHETIC' in z.read('training/case.json');assert b'No authenticity' in z.read('reports/intake-report.html');assert 'EXAMPLE-GUIDE.txt' not in z.namelist()", join(output, 'synthetic-handoff.zip'), extracted], { encoding: 'utf8' }); expect(python.status, python.stderr).toBe(0); const receipt = success(verify('verify-training-lineage', join(extracted, 'training', 'training.json'), join(extracted, 'lineage', 'lineage.json'), '--confirm-wgs84')); expect(receipt.conversions).toHaveLength(1); expect(receipt.training.bundle_count).toBe(3);
});
it('never overwrites an existing directory, file or symlink target and refuses implicit parent creation', async () => {
  await mkdir(output); await writeFile(join(output, 'KEEP.txt'), 'KEEP'); failure(run('--output-dir', output)); expect(await readdir(output)).toEqual(['KEEP.txt']); expect(await readFile(join(output, 'KEEP.txt'), 'utf8')).toBe('KEEP'); const file = join(dir, 'file'); await writeFile(file, 'KEEP'); failure(run('--output-dir', file)); expect(await readFile(file, 'utf8')).toBe('KEEP'); const alias = join(dir, 'alias'); await symlink(output, alias); failure(run('--output-dir', alias)); expect(await readdir(output)).toEqual(['KEEP.txt']); failure(run('--output-dir', join(dir, 'missing', 'child'))); expect(await readdir(dir)).not.toContain('missing');
});
it('supports help but accepts only one explicit new-directory option, no scans, input paths, duplicate or unknown switches', async () => {
  expect(run('--help').status).toBe(0); for (const args of [[], [output], ['--output-dir'], ['--output-dir', output, '--output-dir', output], ['--output-dir', output, '--input', 'private.csv'], ['--unknown', output], ['--output-dir', '--help']]) failure(run(...args)); expect(await readdir(dir)).toEqual([]);
});
