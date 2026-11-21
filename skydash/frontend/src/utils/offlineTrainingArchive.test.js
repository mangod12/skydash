import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, readdir, stat, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash, parseFlightCSV } from './flightLog';
import { storedZip } from '../../scripts/package-training-intake.mjs';
let dir, manifest, output, text, entry;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (...args) => spawnSync(process.execPath, ['scripts/package-training-intake.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const check = (...args) => run(manifest, '--output', output, ...args);
const success = result => { expect(result.status, result.stderr).toBe(0); for (const value of ['PRIVATE', '28.6139', '77.209']) expect(result.stdout).not.toContain(value); return JSON.parse(result.stdout); };
const failure = result => { expect(result.status).toBe(1); expect(result.stdout).toBe(''); for (const value of ['PRIVATE', '28.6139', '77.209']) expect(result.stderr).not.toContain(value); };
const save = () => writeFile(manifest, JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: [entry] }));
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-archive-')); manifest = join(dir, 'PRIVATE-manifest.json'); output = join(dir, 'PRIVATE-output.zip');
  const log = { filename: 'PRIVATE.csv', title: 'PRIVATE', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) }; text = await createReviewCase(log, { title: 'PRIVATE', notes: 'PRIVATE original review' }, { markers: [], notes: '' }, null); await writeFile(join(dir, 'case.json'), text); entry = { kind: 'case', path: 'case.json', sha256: hash(text) }; await save();
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('writes one explicit new unencrypted archive with original bytes, deterministic ZIP CRC, report and no private stdout', async () => {
  const before = await readFile(manifest), receipt = success(check()); expect(receipt.bundle_count).toBe(1); expect(receipt.archive_file_count).toBe(5); expect(receipt.conversion_lineage_included).toBe(false); const bytes = await readFile(output); expect(receipt.exact_archive_sha256).toBe(hash(bytes)); expect((await stat(output)).mode & 0o777).toBe(0o600); expect(await readFile(manifest)).toEqual(before); expect(await readFile(join(dir, 'case.json'), 'utf8')).toBe(text);
  const python = spawnSync('python3', ['-c', "import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read('training/case.json').decode()==open(sys.argv[2]).read();assert b'No authenticity' in z.read('reports/intake-report.html');assert b'PRIVATE original review' in z.read('training/case.json');print(json.dumps(z.namelist()))", output, join(dir, 'case.json')], { encoding: 'utf8' }); expect(python.status, python.stderr).toBe(0); expect(JSON.parse(python.stdout)).toContain('reports/validation.json'); const other = join(dir, 'other.zip'); success(run(manifest, '--output', other)); expect(await readFile(other)).toEqual(bytes);
});
it('never overwrites existing output, original artifact, manifest or symlink destination', async () => {
  await writeFile(output, 'KEEP'); failure(check()); expect(await readFile(output, 'utf8')).toBe('KEEP'); failure(run(manifest, '--output', manifest)); failure(run(manifest, '--output', join(dir, 'case.json'))); const alias = join(dir, 'alias.zip'); await symlink(output, alias); failure(run(manifest, '--output', alias)); expect(await readFile(output, 'utf8')).toBe('KEEP'); expect(await readFile(join(dir, 'case.json'), 'utf8')).toBe(text);
});
it.each(['json', 'pin', 'kind', 'source', 'receipt'])('refuses %s original validation before creating any output', async kind => {
  if (kind === 'json') await writeFile(manifest, 'PRIVATE malformed');
  if (kind === 'pin') { entry.sha256 = 'a'.repeat(64); await save(); }
  if (kind === 'kind') { entry.kind = 'paired'; await save(); }
  if (kind === 'source') { const raw = JSON.parse(text); raw.source.sha256 = 'b'.repeat(64); const bytes = JSON.stringify(raw); await writeFile(join(dir, 'case.json'), bytes); entry.sha256 = hash(bytes); await save(); }
  if (kind === 'receipt') await writeFile(manifest, JSON.stringify({ format: 'skydash-training-intake-receipt-v2', receipts: [] }));
  failure(check()); expect(await readdir(dir)).not.toContain('PRIVATE-output.zip');
});
it('pins original raw manifest independently and refuses mismatches without creating the archive', async () => {
  failure(check('--expect-sha256', 'f'.repeat(64))); expect(await readdir(dir)).not.toContain('PRIVATE-output.zip'); success(check('--expect-sha256', hash(await readFile(manifest)).toUpperCase()));
});
it('preserves nested paths in the archive while refusing case-insensitive extraction collisions', async () => {
  await mkdir(join(dir, 'nested')); await writeFile(join(dir, 'nested', 'case.json'), text); entry.path = 'nested/case.json'; await save(); success(check()); await rm(output); await writeFile(join(dir, 'CASE.json'), text); await writeFile(manifest, JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: [{ ...entry, path: 'case.json' }, { ...entry, path: 'CASE.json' }] })); failure(check()); expect(await readdir(dir)).not.toContain('PRIVATE-output.zip');
});
it('uses safe deterministic ZIP names, rejects traversal/control/reserved names and keeps UTF8 exact', () => {
  for (const name of ['../bad', '/bad', 'a\\b', 'bad\nname', 'C:bad', 'CON', 'a./b', 'a /b', 'Lpt1.txt', 'a<b', 'a>b', 'a"b', 'a|b', 'a?b', 'a*b', 'CONIN$', 'conout$.txt', 'COM¹.txt', 'a/LPT²']) expect(() => storedZip([[name, Buffer.from('x')]])).toThrow(); expect(() => storedZip([['é', Buffer.from('x')], ['e\u0301', Buffer.from('x')]])).toThrow(); for (const entries of [[['a', 'x'], ['A/b', 'y']], [['folder/file', 'y'], ['FOLDER', 'x']], [['é', 'x'], ['e\u0301/b', 'y']]]) expect(() => storedZip(entries)).toThrow(); const bytes = storedZip([['folder/नोट.json', Buffer.from('PRIVATE')]]); expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304'); expect(bytes.includes(Buffer.from('नोट.json'))).toBe(true);
});
it('requires explicit output and strict nonrepeated options with no implicit scan or saved receipt input', () => {
  expect(run('--help').status).toBe(0); for (const args of [[], [manifest], [manifest, '--output'], [manifest, '--output', output, '--unknown'], [manifest, '--output', output, '--output', output], [manifest, '--output', output, '--expect-sha256', 'bad'], [manifest, '--output', output, '--confirm-wgs84'], [manifest, '--output', output, '--require-all-review-sources'], [manifest, '--output', output, '--lineage-manifest', manifest]]) failure(run(...args));
});
async function lineage() {
  const { convertMappedCSV, readMappingCSV } = await import('./csvColumnMapping'), { exportMappingRecipe } = await import('./mappingRecipe');
  const raw = 'clock,lat,lon\n1000,28.6,77.2\n3000,28.61,77.21\n', mapping = { columns: { time_s: 0, latitude: 1, longitude: 2, altitude_m: null, ground_speed_m_s: null, battery_pct: null }, timeUnit: 'ms', timeOrigin: 'subtract-first', altitudeUnit: 'm', speedUnit: 'm/s', coordinateReference: 'WGS84-decimal-degrees' }, recipe = exportMappingRecipe(readMappingCSV(raw).headers, mapping, 'PRIVATE recipe'), mapped = await convertMappedCSV(raw, 'PRIVATE.csv', mapping);
  const parts = { original: ['original.csv', raw], recipe: ['recipe.json', recipe], converted: ['converted.csv', mapped.csv_text] };
  for (const [name, bytes] of Object.values(parts)) await writeFile(join(dir, name), bytes);
  const path = join(dir, 'lineage.json'); await writeFile(path, JSON.stringify({ format: 'skydash-training-lineage-manifest-v1', conversions: [Object.fromEntries(Object.entries(parts).map(([role, [path, bytes]]) => [role, { path, sha256: hash(bytes) }]))] })); return path;
}
it('optionally archives every checked original conversion with separate roots, flags unlinked source and retains exact bytes', async () => {
  const path = await lineage(); failure(check('--lineage-manifest', path)); failure(check('--lineage-manifest', path, '--confirm-wgs84', '--require-all-review-sources')); const receipt = success(check('--lineage-manifest', path, '--confirm-wgs84', '--expect-lineage-sha256', hash(await readFile(path)).toUpperCase())); expect(receipt.conversion_lineage_included).toBe(true); expect(receipt.archive_file_count).toBe(9);
  const python = spawnSync('python3', ['-c', "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read('lineage/original.csv')==open(sys.argv[2],'rb').read();assert b'No exact relation' in z.read('reports/intake-report.html');assert b'Fresh WGS84' in z.read('reports/READ-ME.txt')", output, join(dir, 'original.csv')], { encoding: 'utf8' }); expect(python.status, python.stderr).toBe(0);
});
it('adds readable private packet only with explicit acknowledgement while retaining original bytes and redacted report',async()=>{
 const defaultPath=join(dir,'default.zip');success(run(manifest,'--output',defaultPath,'--expect-sha256',hash(await readFile(manifest))));const receipt=success(check('--include-private-review','--expect-sha256',hash(await readFile(manifest))));expect(receipt.private_discussion_included).toBe(true);expect(receipt.archive_file_count).toBe(6);expect(receipt.exact_archive_sha256).toBe(hash(await readFile(output)));const inspected=spawnSync('python3',['-c',"import zipfile,sys;d=zipfile.ZipFile(sys.argv[1]);z=zipfile.ZipFile(sys.argv[2]);assert 'reports/private-discussion.html' not in d.namelist();assert b'SENSITIVE PRIVATE DISCUSSION' not in d.read('reports/READ-ME.txt');assert z.testzip() is None;assert z.read('training/case.json')==d.read('training/case.json');assert z.read('reports/intake-report.html')==d.read('reports/intake-report.html');assert z.read('reports/validation.json')==d.read('reports/validation.json');p=z.read('reports/private-discussion.html');assert b'PRIVATE original review' in p and b'Private training discussion packet' in p;assert b'<script' not in p;assert b'PRIVATE original review' not in z.read('reports/intake-report.html');assert b'PRIVATE DISCUSSION PACKET INCLUDED' in z.read('reports/READ-ME.txt');assert b'private packet does not check conversion lineage' in z.read('reports/READ-ME.txt')",defaultPath,output],{encoding:'utf8'});expect(inspected.status,inspected.stderr).toBe(0);const other=join(dir,'other-private.zip');success(run(manifest,'--output',other,'--include-private-review','--expect-sha256',hash(await readFile(manifest))));expect(await readFile(other)).toEqual(await readFile(output));
});
it('keeps optional lineage evidence separate from private packet and requires fresh confirmation before archive creation',async()=>{const path=await lineage();failure(check('--include-private-review','--lineage-manifest',path));expect(await readdir(dir)).not.toContain('PRIVATE-output.zip');const receipt=success(check('--include-private-review','--lineage-manifest',path,'--confirm-wgs84'));expect(receipt.private_discussion_included).toBe(true);expect(receipt.conversion_lineage_included).toBe(true);expect(receipt.archive_file_count).toBe(10);const inspected=spawnSync('python3',['-c',"import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert b'Reproduced conversion relations' in z.read('reports/intake-report.html');assert b'conversion-lineage check' in z.read('reports/private-discussion.html');assert b'PRIVATE original review' in z.read('reports/private-discussion.html');assert b'No independent complete-manifest digest supplied' in z.read('reports/private-discussion.html');assert z.read('lineage/original.csv')==open(sys.argv[2],'rb').read()",output,join(dir,'original.csv')],{encoding:'utf8'});expect(inspected.status,inspected.stderr).toBe(0);});
it('refuses repeated private flag and stricter private path aliases before creating output',async()=>{failure(check('--include-private-review','--include-private-review'));expect(await readdir(dir)).not.toContain('PRIVATE-output.zip');const alias=join(dir,'case-alias.json');await symlink(join(dir,'case.json'),alias);entry.path='case-alias.json';await save();failure(check('--include-private-review'));expect(await readdir(dir)).not.toContain('PRIVATE-output.zip');});
