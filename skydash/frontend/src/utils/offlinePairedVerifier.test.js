import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto, createHash } from 'node:crypto';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, parseFlightCSV, flightCSVHash, LOG_VERSION } from './flightLog';
let dir, path, text;
const run = (...args) => spawnSync(process.execPath, ['scripts/verify-paired-review.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-pair-')); path = join(dir, 'bundle.json');
  const log = { filename: 'PRIVATE.csv', title: 'PRIVATE title', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  text = await createPairedReviewBundle({ log, review: { title: log.title, notes: 'PRIVATE analyst notes' }, debrief: { markers: [], notes: '' }, envelope: null }, { baseline: log, notes: 'PRIVATE comparison notes', alignment: null }); await writeFile(path, text);
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('validates an exact paired file without a browser and prints only a bounded non-private receipt without changing input', async () => {
  const result = run(path); expect(result.status).toBe(0); const receipt = JSON.parse(result.stdout); expect(receipt.primary.samples).toBe(6); expect(receipt.baseline.samples).toBe(6); expect(receipt.identical_source_bytes).toBe(true); expect(receipt.included_reviews.evaluated_envelope).toBe(false); for (const value of ['PRIVATE', '28.6139', '77.209']) expect(result.stdout).not.toContain(value); expect(await readFile(path, 'utf8')).toBe(text); expect(Object.keys(receipt.primary).sort()).toEqual(['end_s', 'samples', 'sha256', 'start_s']);
});
it('creates sensitive readable output only with an explicit new path, never overwrites any file or the input', async () => {
  const report = join(dir, 'report.txt'); const result = run(path, '--report', report); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).readable_report_written).toBe(true); expect(await readFile(report, 'utf8')).toContain('PRIVATE analyst notes'); if (process.platform !== 'win32') expect((await stat(report)).mode & 0o777).toBe(0o600);
  await writeFile(report, 'Existing report'); expect(run(path, '--report', report).status).toBe(1); expect(await readFile(report, 'utf8')).toBe('Existing report'); expect(run(path, '--report', path).status).toBe(1); expect(await readFile(path, 'utf8')).toBe(text);
});
it('rejects malformed JSON, UTF-8, mismatched nested source and oversize files without echoing private input or issuing a receipt', async () => {
  const bad = JSON.parse(text); bad.comparison.baseline.sha256 = 'b'.repeat(64);
  for (const input of ['PRIVATE malformed JSON', Buffer.from([0xff]), JSON.stringify(bad), 'x'.repeat(4 * 1024 * 1024 + 1)]) {
    await writeFile(path, input); const result = run(path); expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain('PRIVATE'); expect((await readFile(path)).equals(Buffer.from(input))).toBe(true);
  }
});
it('rejects missing files and invalid arguments and offers scope-specific help without private output', () => {
  expect(run(join(dir, 'absent.json')).status).toBe(1); expect(run(path, '--overwrite', 'target').status).toBe(1); expect(run().status).toBe(1); const help = run('--help'); expect(help.status).toBe(0); expect(help.stdout).toContain('Optional report is sensitive');
});

it('receipts bind exact complete bundle bytes separately from embedded source hashes, including notes and whitespace', async () => {
  const original = JSON.parse(run(path).stdout); expect(original.exact_bundle_sha256).toBe(createHash('sha256').update(text).digest('hex')); expect(original.expected_bundle_digest_matched).toBe(false);
  for (const changed of [text + '\n', text.replace('PRIVATE comparison notes', 'EDITED comparison notes')]) {
    await writeFile(path, changed); const result = run(path); expect(result.status).toBe(0); const edited = JSON.parse(result.stdout); expect(edited.primary.sha256).toBe(original.primary.sha256); expect(edited.baseline.sha256).toBe(original.baseline.sha256); expect(edited.exact_bundle_sha256).not.toBe(original.exact_bundle_sha256);
    const report = join(dir, 'unexpected.txt'); const failed = run(path, '--report', report, '--expect-sha256', original.exact_bundle_sha256); expect(failed.status).toBe(1); expect(failed.stdout).toBe(''); await expect(stat(report)).rejects.toThrow();
  }
});
it('checks a separately supplied complete-bundle digest before any report output and rejects duplicate/invalid digest options', async () => {
  const digest = createHash('sha256').update(text).digest('hex'); const result = run(path, '--expect-sha256', digest.toUpperCase()); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).expected_bundle_digest_matched).toBe(true);
  for (const args of [['--constructor','bad'], ['--__proto__','bad'], ['--expect-sha256','bad'], ['--expect-sha256',digest,'--expect-sha256',digest], ['--report','new.txt','--report','other.txt'], ['--expect-sha256']]) { const bad = run(path, ...args); expect(bad.status).toBe(1); expect(bad.stdout).toBe(''); }
  const report = join(dir, 'matched.txt'); expect(run(path, '--expect-sha256',digest,'--report',report).status).toBe(0); expect(await readFile(report,'utf8')).toContain('PRIVATE analyst notes');
});
