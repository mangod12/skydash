import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inspectStoredDistribution, verifyOfflineArchive } from '../../scripts/verify-offline-archive.mjs';
import { storedZip } from '../../scripts/package-training-intake.mjs';
import { distributionGuide } from '../../scripts/offline-review-distribution.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let dir, path, bytes, entries, raw;
function makeEntries() {
  const js = 'site/assets/offline-review-ABCDEFGH.js', css = 'site/assets/offline-review-abcdefgh.css';
  const html = `<title>SkyDash - Standalone Recorded Review</title><meta content="connect-src 'none'; worker-src 'none'"><script src="./${js.slice(5)}"></script><link href="./${css.slice(5)}">`;
  const files = [['site/offline-review.html', Buffer.from(html)], [js, Buffer.from('throw Error("PRIVATE executable must never run")')], [css, Buffer.from('/* PRIVATE */')], ['START.txt', Buffer.from(distributionGuide)]];
  const manifest = Buffer.from(JSON.stringify({ format: 'skydash-standalone-distribution-v1', files: files.map(([path, data]) => ({ path, bytes: data.length, sha256: hash(data) })) }));
  return [...files, ['distribution.json', manifest]];
}
const run = (...args) => spawnSync(process.execPath, ['scripts/verify-offline-archive.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 10000 });
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'skydash-zipcheck-')); path = join(dir, 'PRIVATE.zip'); entries = makeEntries(); raw = entries[4][1]; bytes = storedZip(entries); await writeFile(path, bytes); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
it('checks exact generated ZIP bytes/CRC/inventory and independent pins without extraction, writes or execution', async () => {
  const before = await readdir(dir), result = await verifyOfflineArchive(path, { expectedArchiveSha256: hash(bytes).toUpperCase(), expectedManifestSha256: hash(raw).toUpperCase() }); expect(result.exact_archive_sha256).toBe(hash(bytes)); expect(result.exact_manifest_sha256).toBe(hash(raw)); expect(result.expected_archive_digest_matched).toBe(true); expect(result.expected_manifest_digest_matched).toBe(true); expect(result.file_count).toBe(5); expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect(await readdir(dir)).toEqual(before); expect(await readFile(path)).toEqual(bytes); expect(inspectStoredDistribution(bytes).expected_archive_digest_matched).toBe(false);
});
it('checks whole archive expectation before ZIP parsing and raw inventory expectation before JSON', () => {
  expect(() => inspectStoredDistribution(Buffer.alloc(22), { expectedArchiveSha256: 'a'.repeat(64) })).toThrow('archive expectation mismatch');
  entries[4][1] = Buffer.from('PRIVATE malformed'); expect(() => inspectStoredDistribution(storedZip(entries), { expectedManifestSha256: 'a'.repeat(64) })).toThrow('manifest expectation mismatch'); expect(() => inspectStoredDistribution(storedZip(entries))).toThrow();
  for (const value of ['bad', ' ', hash(bytes) + ' ']) expect(() => inspectStoredDistribution(bytes, { expectedArchiveSha256: value })).toThrow();
});
it('rejects every modified local/central field, CRC, payload, trailing bytes, truncation and extra entry', () => {
  const central = bytes.indexOf(Buffer.from('504b0102', 'hex')), end = bytes.length - 22;
  for (const offset of [4,6,8,10,12,14,18,22,26,28,30,100,central + 4,central + 8,central + 10,central + 16,central + 20,central + 24,central + 28,central + 30,central + 32,central + 34,central + 38,central + 42,end + 4,end + 6,end + 8,end + 10,end + 12,end + 16,end + 20]) { const changed = Buffer.from(bytes); changed[offset] ^= 1; expect(() => inspectStoredDistribution(changed), String(offset)).toThrow(); }
  for (const length of [0,21,29,100,bytes.length - 1]) expect(() => inspectStoredDistribution(bytes.subarray(0, length))).toThrow(); expect(() => inspectStoredDistribution(Buffer.concat([bytes, Buffer.from('extra')]))).toThrow(); expect(() => inspectStoredDistribution(storedZip([...entries, ['extra', Buffer.from('x')]]))).toThrow();
});
it('refuses unsupported compressed/encrypted/descriptors/ZIP64 methods and impossible sizes without decompression', () => {
  for (const [offset, value] of [[6,0x801],[6,0x808],[8,8],[4,45],[26,0xffff],[28,0xffff]]) { const changed = Buffer.from(bytes); changed.writeUInt16LE(value, offset); expect(() => inspectStoredDistribution(changed)).toThrow(); }
  const huge = Buffer.from(bytes); huge.writeUInt32LE(0xffffffff,18); huge.writeUInt32LE(0xffffffff,22); expect(() => inspectStoredDistribution(huge)).toThrow(); expect(() => inspectStoredDistribution(Buffer.alloc(17 * 1024 * 1024 + 1))).toThrow();
});
it('requires fixed safe paths, exact order, no folders/duplicates and full nested inventory agreement', () => {
  for (const name of ['other.json','site/private.json','site/assets/nested/file.js','site/assets/offline-review-bad.js']) { const changed = entries.map(([n,b]) => [n,b]); changed[1][0]=name; expect(() => inspectStoredDistribution(storedZip(changed))).toThrow(); }
  const swapped = [...entries]; [swapped[1],swapped[2]]=[swapped[2],swapped[1]]; expect(() => inspectStoredDistribution(storedZip(swapped))).toThrow();
  for (const change of [m=>{m.files[0].sha256='a'.repeat(64);},m=>{m.files[0].path='../../PRIVATE';},m=>{m.extra=true;},m=>{m.files.pop();},m=>{m.files[0].bytes++;}]) { const m = JSON.parse(raw); change(m); const changed = [...entries]; changed[4] = ['distribution.json',Buffer.from(JSON.stringify(m))]; expect(() => inspectStoredDistribution(storedZip(changed))).toThrow(); }
  const guide = [...entries]; guide[3]=['START.txt',Buffer.from('PRIVATE altered guide')]; expect(() => inspectStoredDistribution(storedZip(guide))).toThrow();
});
it('rejects symlink/special/oversize files and invalid options before reading file content', async () => {
  const link=join(dir,'alias.zip');await symlink(path,link); await expect(verifyOfflineArchive(link)).rejects.toThrow(); await expect(verifyOfflineArchive('/missing/PRIVATE',{expectedArchiveSha256:'bad'})).rejects.toThrow('Invalid expectation');
  const fifo=join(dir,'fifo.zip');expect(spawnSync('mkfifo',[fifo]).status).toBe(0);await expect(verifyOfflineArchive(fifo)).rejects.toThrow(); const huge=join(dir,'huge.zip');await writeFile(huge,Buffer.alloc(17*1024*1024+1));await expect(verifyOfflineArchive(huge)).rejects.toThrow();await expect(verifyOfflineArchive(dir)).rejects.toThrow();
});
it('has strict CLI, private errors and empty stdout on any refusal', async () => {
  expect(run('--help').status).toBe(0); for (const args of [[],[path,'--unknown'],[path,'--expect-archive-sha256','bad'],[path,'--expect-manifest-sha256',hash(raw),'--expect-manifest-sha256',hash(raw)],[path,'--expect-archive-sha256','a'.repeat(64)]]) {const r=run(...args);expect(r.status).toBe(1);expect(r.stdout).toBe('');expect(r.stderr).not.toContain('PRIVATE');} const r=run(path,'--expect-manifest-sha256',hash(raw),'--expect-archive-sha256',hash(bytes));expect(r.status,r.stderr).toBe(0);expect(JSON.parse(r.stdout).expected_archive_digest_matched).toBe(true);expect(r.stdout).not.toContain('PRIVATE'); expect(await readdir(dir)).toEqual(['PRIVATE.zip']);
});
it('agrees with independent Python ZIP parsing on original entries but refuses a rewritten compressed ZIP', async () => {
  const other=join(dir,'compressed.zip');const r=spawnSync('python3',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert len(z.namelist())==5;o=zipfile.ZipFile(sys.argv[2],"w",compression=zipfile.ZIP_DEFLATED);[o.writestr(n,z.read(n)) for n in z.namelist()];o.close()',path,other],{encoding:'utf8'});expect(r.status,r.stderr).toBe(0);await expect(verifyOfflineArchive(other)).rejects.toThrow();
});
