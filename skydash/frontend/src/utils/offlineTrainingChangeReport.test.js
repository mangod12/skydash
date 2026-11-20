import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash, parseFlightCSV } from './flightLog';
let dir, left, right, log, text, pair, entries;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (...args) => spawnSync(process.execPath, ['scripts/report-training-comparison.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const success = result => { expect(result.status, result.stderr).toBe(0); for (const value of ['PRIVATE', '28.6139', '77.209', '<script', '<iframe', '<img ', 'https://', 'http://']) expect(result.stdout).not.toContain(value); return result.stdout; };
const failure = result => { expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain('PRIVATE'); };
const save = (path, bundles = entries, format = 'skydash-training-intake-manifest-v2') => writeFile(path, JSON.stringify({ format, bundles }));
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-change-report-')); left = join(dir, 'PRIVATE-left.json'); right = join(dir, 'PRIVATE-right.json');
  log = { filename: 'PRIVATE.csv', title: 'PRIVATE<script>alert(1)</script>', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  text = await createReviewCase(log, { title: log.title, notes: 'PRIVATE review' }, { markers: [], notes: '' }, null);
  pair = await createPairedReviewBundle({ log, review: { title: log.title, notes: 'PRIVATE analyst' }, debrief: { markers: [], notes: '' }, envelope: null }, { baseline: { ...log }, notes: 'PRIVATE comparison', alignment: null });
  await writeFile(join(dir, 'PRIVATE-case.json'), text); await writeFile(join(dir, 'PRIVATE-pair.json'), pair); entries = [{ kind: 'case', path: 'PRIVATE-case.json', sha256: hash(text) }, { kind: 'paired', path: 'PRIVATE-pair.json', sha256: hash(pair) }]; await save(left); await save(right);
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('validates originals before static deterministic private-text-free HTML with complete role references and no writes', async () => {
  const files = await readdir(dir), html = success(run(left, right)); expect(html).toContain('<!doctype html>'); expect(html).toContain("default-src 'none'"); expect(html).toContain('Ordered complete-artifact sequence: equal'); expect(html).toContain('Complete manifest bytes: equal'); expect(html).toContain('Complete-artifact occurrence inventory: equal'); expect(html).toContain('CSV source occurrence inventory: equal'); for (const role of ['Bundle 1: case / source', 'Bundle 2: paired / primary', 'Bundle 2: paired / baseline']) expect(html.split(role)).toHaveLength(3); expect(html).toContain(log.sha256); expect(html).toContain(hash(text)); expect(html).toContain(hash(pair)); expect(success(run(left, right))).toBe(html); expect(await readdir(dir)).toEqual(files); expect(await readFile(join(dir, 'PRIVATE-case.json'), 'utf8')).toBe(text);
});
it('shows reordered ordinals without guessing chronology or changed review text', async () => {
  await save(right, entries.slice().reverse()); const html = success(run(left, right)); expect(html).toContain('Ordered complete-artifact sequence: different'); expect(html).toContain('Complete-artifact occurrence inventory: equal'); expect(html).toContain('CSV source occurrence inventory: equal'); expect(html).toContain('Bundle 2: case / source'); expect(html).toContain('Bundle 1: paired / primary'); expect(html).toContain('not verified earlier/later revisions');
});
it('does not call manifest formatting/path differences an artifact change', async () => {
  await writeFile(right, (await readFile(right, 'utf8')) + '\n'); const html = success(run(left, right)); expect(html).toContain('Complete manifest bytes: different'); expect(html).toContain('Ordered complete-artifact sequence: equal'); expect(html).toContain('Different bytes alone do not prove review content changed.');
});
it('keeps review-only exact artifact differences separate from equal CSV source counts without pairing', async () => {
  const raw = JSON.parse(text); raw.review.notes = 'PRIVATE edited'; const changed = JSON.stringify(raw); await writeFile(join(dir, 'alternate.json'), changed); await save(right, [{ ...entries[0], path: 'alternate.json', sha256: hash(changed) }, entries[1]]); const html = success(run(left, right)); expect(html).toContain('Complete-artifact occurrence inventory: different'); expect(html).toContain('CSV source occurrence inventory: equal'); expect(html.match(/No exact occurrence on this side\./g)).toHaveLength(2); expect(html).toContain('No annotation-level comparison or guessed left/right pairing');
});
it('retains all repeated references and count differences including identical paired roles', async () => {
  await writeFile(join(dir, 'copy.json'), text); await save(right, [...entries, { ...entries[0], path: 'copy.json' }]); const html = success(run(left, right)); expect(html).toContain('Right: 4 occurrences'); expect(html).toContain('Bundle 3: case / source'); expect(html).toContain('CSV source occurrence inventory: different'); expect(html).toContain('These are file/role references, not independent flights or people.');
});
it('shows every unequal source and retains its actual role instead of inferring review-only change', async () => {
  const csv = SAMPLE_LOG.replace('28.6139', '28.6140'), baseline = { ...log, csv_text: csv, sha256: await flightCSVHash(csv), samples: parseFlightCSV(csv) }, changed = await createPairedReviewBundle({ log, review: { title: log.title, notes: '' }, debrief: { markers: [], notes: '' }, envelope: null }, { baseline, notes: '', alignment: null }); await writeFile(join(dir, 'changed.json'), changed); await save(right, [entries[0], { ...entries[1], path: 'changed.json', sha256: hash(changed) }]); const html = success(run(left, right)); expect(html).toContain('CSV source occurrence inventory: different'); expect(html).toContain(baseline.sha256); expect(html).toContain('CSV source group 2'); expect(html).toContain('Left: 0 occurrences'); expect(html).toContain('Bundle 2: paired / baseline');
});
it('pins each raw original manifest separately and accepts uppercase expectations', async () => {
  const lh = hash(await readFile(left)), rh = hash(await readFile(right)); const html = success(run(left, right, '--expect-left-sha256', lh.toUpperCase())); expect(html.match(/Caller-supplied expected complete-manifest digest matched/g)).toHaveLength(1); expect(html.match(/No independent complete-manifest expectation supplied/g)).toHaveLength(1); success(run(left, right, '--expect-left-sha256', lh, '--expect-right-sha256', rh)); failure(run(left, right, '--expect-right-sha256', 'a'.repeat(64)));
});
it.each(['left', 'right'].flatMap(side => ['malformed', 'pin', 'nested', 'receipt'].map(kind => [side, kind])))('rejects %s %s originals before any partial HTML', async (side, kind) => {
  const path = side === 'left' ? left : right;
  if (kind === 'malformed') await writeFile(path, Buffer.from([255]));
  if (kind === 'pin') await save(path, [{ ...entries[0], sha256: 'b'.repeat(64) }]);
  if (kind === 'receipt') await writeFile(path, JSON.stringify({ format: 'skydash-training-package-comparison-v1' }));
  if (kind === 'nested') { const raw = JSON.parse(text); raw.source.sha256 = 'b'.repeat(64); const invalid = JSON.stringify(raw); await writeFile(join(dir, 'bad.json'), invalid); await save(path, [{ ...entries[0], path: 'bad.json', sha256: hash(invalid) }]); }
  failure(run(left, right));
});
it('rejects strict CLI errors without output and supports help', () => {
  expect(run('--help').status).toBe(0); for (const args of [[], [left], [left, right, '--bad', 'x'], [left, right, '--expect-right-sha256'], [left, right, '--expect-left-sha256', 'bad'], [left, right, '--expect-left-sha256', 'a'.repeat(64), '--expect-left-sha256', 'a'.repeat(64)], [dir, right], [left, join(dir, 'missing.json')]]) failure(run(...args));
});
