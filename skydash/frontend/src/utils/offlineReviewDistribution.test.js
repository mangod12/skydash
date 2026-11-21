import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, stat, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeOfflineDistribution, verifyOfflineDistribution, distributionGuide } from '../../scripts/offline-review-distribution.mjs';
let dir, build, output, extracted;
const js = 'offline-review-ABCDEFGH.js', css = 'offline-review-abcdefgh.css';
const html = `<title>SkyDash - Standalone Recorded Review</title><meta content="connect-src 'none'; worker-src 'none'"><script src="./assets/${js}"></script><link href="./assets/${css}">`;
const run = (...args) => spawnSync(process.execPath, ['scripts/offline-review-distribution.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 10000 });
async function extract() {
  const result = spawnSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;z.extractall(sys.argv[2])', output, extracted], { encoding: 'utf8' }); expect(result.status, result.stderr).toBe(0);
}
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'skydash-distribution-')); build = join(dir, 'PRIVATE-build'); output = join(dir, 'PRIVATE.zip'); extracted = join(dir, 'PRIVATE-extracted'); await mkdir(join(build, 'assets'), { recursive: true }); await writeFile(join(build, 'offline-review.html'), html); await writeFile(join(build, 'assets', js), 'throw Error("PRIVATE executable must never run");'); await writeFile(join(build, 'assets', css), '/* PRIVATE */body{}'); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
it('creates deterministic exact static ZIP and independently pins extracted inventory without executing JavaScript', async () => {
  const result = await writeOfflineDistribution(build, output); expect(result.file_count).toBe(5); expect(result.scope).toContain('unsigned executable'); expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect((await stat(output)).mode & 0o777).toBe(0o600); await extract(); const checked = await verifyOfflineDistribution(extracted, result.exact_manifest_sha256.toUpperCase()); expect(checked.expected_manifest_digest_matched).toBe(true); expect(checked.file_count).toBe(5); expect(checked.exact_manifest_sha256).toBe(result.exact_manifest_sha256); expect((await verifyOfflineDistribution(extracted)).expected_manifest_digest_matched).toBe(false); expect(await readFile(join(extracted, 'site/assets', js))).toEqual(await readFile(join(build, 'assets', js))); expect(await readFile(join(extracted, 'START.txt'), 'utf8')).toBe(distributionGuide); const other = join(dir, 'other.zip'); await writeOfflineDistribution(build, other); expect(await readFile(other)).toEqual(await readFile(output));
});
it('never overwrites existing files, symlink destinations or any input path', async () => { await writeFile(output, 'KEEP'); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); const folderAlias = join(dir, 'folder-alias'); await symlink(build, folderAlias); await expect(writeOfflineDistribution(build, join(folderAlias, 'new.zip'))).rejects.toThrow(); const alias = join(dir, 'alias.zip'); await symlink(output, alias); await expect(writeOfflineDistribution(build, alias)).rejects.toThrow(); await expect(writeOfflineDistribution(build, join(build, 'new.zip'))).rejects.toThrow(); expect(await readFile(output, 'utf8')).toBe('KEEP'); expect(await readFile(join(build, 'offline-review.html'), 'utf8')).toBe(html); });
it('rejects extra files, sourcemaps, nested folders, missing/unsupported assets and wrong entry before output creation', async () => {
  for (const name of ['PRIVATE.json', 'credentials.env']) { await writeFile(join(build, name), 'PRIVATE'); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); await rm(join(build, name)); }
  await mkdir(join(build, 'assets', 'nested')); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); await rm(join(build, 'assets', 'nested'), { recursive: true });
  await writeFile(join(build, 'assets', js + '.map'), '{}'); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); await rm(join(build, 'assets', js + '.map'));
  await rm(join(build, 'assets', css)); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); await writeFile(join(build, 'assets', css), 'x');
  await writeFile(join(build, 'offline-review.html'), 'PRIVATE not standalone'); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); expect(await readdir(dir)).not.toContain('PRIVATE.zip');
});
it('rejects symlink files, asset directory and root for creation and received verification', async () => {
  const outside = join(dir, 'outside'); await writeFile(outside, 'PRIVATE'); await rm(join(build, 'assets', js)); await symlink(outside, join(build, 'assets', js)); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); await rm(join(build, 'assets', js)); await writeFile(join(build, 'assets', js), 'x');
  const alias = join(dir, 'alias'); await symlink(build, alias); await expect(writeOfflineDistribution(alias, output)).rejects.toThrow();
  await writeOfflineDistribution(build, output); await extract(); await rm(join(extracted, 'START.txt')); await symlink(outside, join(extracted, 'START.txt')); await expect(verifyOfflineDistribution(extracted)).rejects.toThrow();
  await rm(join(build, 'assets'), { recursive: true }); await symlink(join(extracted, 'site/assets'), join(build, 'assets')); await expect(writeOfflineDistribution(build, join(dir, 'other.zip'))).rejects.toThrow();
});
it('checks independent raw manifest pin before parsing or artifact processing, strict schema/ordinals and all exact bytes', async () => {
  const receipt = await writeOfflineDistribution(build, output); await extract(); const manifestPath = join(extracted, 'distribution.json'), raw = await readFile(manifestPath), original = JSON.parse(raw);
  await writeFile(manifestPath, 'PRIVATE malformed'); await expect(verifyOfflineDistribution(extracted, 'a'.repeat(64))).rejects.toThrow('expectation mismatch'); await expect(verifyOfflineDistribution(extracted)).rejects.toThrow(); await writeFile(manifestPath, raw);
  for (const mutate of [m => { m.extra = true; }, m => { m.format = 'receipt'; }, m => { m.files.reverse(); }, m => { m.files[0].path = '../../PRIVATE'; }, m => { m.files[0].bytes++; }, m => { m.files[0].sha256 = 'a'.repeat(64); }, m => { m.files[0].extra = true; }, m => { m.files.pop(); }]) { const data = structuredClone(original); mutate(data); await writeFile(manifestPath, JSON.stringify(data)); await expect(verifyOfflineDistribution(extracted)).rejects.toThrow(); }
  await writeFile(manifestPath, raw); await writeFile(join(extracted, 'site/assets', js), 'PRIVATE changed'); await expect(verifyOfflineDistribution(extracted, receipt.exact_manifest_sha256)).rejects.toThrow();
});
it('requires all and only extracted files, exact fixed guide and bounded regular files', async () => {
  await writeOfflineDistribution(build, output); await extract(); await writeFile(join(extracted, 'PRIVATE.json'), '{}'); await expect(verifyOfflineDistribution(extracted)).rejects.toThrow(); await rm(join(extracted, 'PRIVATE.json'));
  await writeFile(join(extracted, 'START.txt'), 'PRIVATE wrong guide'); await expect(verifyOfflineDistribution(extracted)).rejects.toThrow(); await writeFile(join(extracted, 'START.txt'), distributionGuide);
  await writeFile(join(extracted, 'site/assets', css), Buffer.alloc(8 * 1024 * 1024 + 1, 32)); await expect(verifyOfflineDistribution(extracted)).rejects.toThrow();
  await writeFile(join(build, 'offline-review.html'), Buffer.alloc(65537, 32)); await expect(writeOfflineDistribution(build, join(dir, 'new.zip'))).rejects.toThrow();
});
it('refuses special files without waiting for a writer and invalid expectations before reads', async () => { await rm(join(build, 'assets', js)); const fifo = spawnSync('mkfifo', [join(build, 'assets', js)], { encoding: 'utf8' }); expect(fifo.status, fifo.stderr).toBe(0); await expect(writeOfflineDistribution(build, output)).rejects.toThrow(); await expect(verifyOfflineDistribution('/missing/PRIVATE', 'bad')).rejects.toThrow('Invalid independent expectation'); });
it('keeps CLI strict, paths/content private, stdout empty on failures and no implicit write/serve/extract action', async () => {
  expect(run('--help').status).toBe(0); for (const args of [[], ['create', build], ['create', build, '--output', output, '--unknown'], ['verify', extracted, '--expect-manifest-sha256', 'bad'], ['verify', extracted, '--output', output], ['extract', output]]) { const result = run(...args); expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain('PRIVATE'); }
  const made = run('create', build, '--output', output); expect(made.status, made.stderr).toBe(0); expect(made.stdout).not.toContain('PRIVATE'); await extract(); const checked = run('verify', extracted, '--expect-manifest-sha256', JSON.parse(made.stdout).exact_manifest_sha256); expect(checked.status, checked.stderr).toBe(0); expect(JSON.parse(checked.stdout).expected_manifest_digest_matched).toBe(true);
});
it('packages and verifies an actual standalone build from the isolated production config', async () => {
  const actual = join(dir, 'actual'); const built = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.offline-review.config.js', '--outDir', actual], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 45000, env: { ...process.env, NODE_ENV: 'production' } }); expect(built.status, built.stderr).toBe(0); const made = await writeOfflineDistribution(actual, output); await extract(); const checked = await verifyOfflineDistribution(extracted, made.exact_manifest_sha256); expect(checked.file_count).toBe(5); expect(await readFile(join(extracted, 'site/offline-review.html'))).toEqual(await readFile(join(actual, 'offline-review.html'))); await copyFile(join(extracted, 'distribution.json'), join(dir, 'inventory-copy.json'));
}, 50000);
