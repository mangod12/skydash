import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash, parseFlightCSV } from './flightLog';
let dir, left, right, text, log;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (...args) => spawnSync(process.execPath, ['scripts/report-review-case-comparison.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const check = (...args) => run(left, right, ...args);
const success = result => { expect(result.status, result.stderr).toBe(0); for (const value of ['PRIVATE', '28.6139', '77.209', '<script', '<iframe', '<img ', 'https://', 'http://', 'maxAltitude']) expect(result.stdout).not.toContain(value); return result.stdout; };
const failure = result => { expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain('PRIVATE'); };
const change = async fn => { const data = JSON.parse(text); await fn(data); await writeFile(right, JSON.stringify(data)); };
const labels = ['Title', 'Analyst notes', 'Instructor marker array', 'Instructor discussion', 'Envelope profile', 'Envelope notes'];
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-case-change-report-')); left = join(dir, 'PRIVATE-left.json'); right = join(dir, 'PRIVATE-right.json');
  log = { filename: 'PRIVATE.csv', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  text = await createReviewCase(log, { title: 'PRIVATE<script>alert(1)</script>', notes: 'PRIVATE notes' }, { markers: [{ id: 'PRIVATE-marker', time_s: 8, kind: 'Question', text: 'PRIVATE marker', discussed: false }], notes: 'PRIVATE discussion' }, { profile: { name: 'PRIVATE profile', maxAltitude: 30, maxSpeed: null, minBattery: 93 }, notes: 'PRIVATE envelope' }); await writeFile(left, text); await writeFile(right, text);
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('validates both originals and prints static deterministic section flags without private text or writes', async () => {
  const files = await readdir(dir), html = success(check()); expect(html).toContain('<!doctype html>'); expect(html).toContain("default-src 'none'"); for (const name of ['Complete artifact bytes', 'Validated case content', 'Embedded CSV source bytes', 'Source filename metadata']) expect(html).toContain(name + ': equal'); for (const name of labels) expect(html).toContain(name + ': unchanged'); expect(html).toContain('Exact source CSV bytes agree. Review sections compared.'); expect(html).toContain(hash(text)); expect(html).toContain(log.sha256); expect(success(check())).toBe(html); expect(await readdir(dir)).toEqual(files); expect(await readFile(left, 'utf8')).toBe(text);
});
it.each(labels)('flags only %s while preserving whole-source gating and normalized section scope', async label => {
  const mutations = { Title: d => { d.review.title += 'x'; }, 'Analyst notes': d => { d.review.notes += 'x'; }, 'Instructor marker array': d => { d.debrief.markers[0].discussed = true; }, 'Instructor discussion': d => { d.debrief.notes += 'x'; }, 'Envelope profile': d => { d.envelope.profile.maxAltitude = 31; }, 'Envelope notes': d => { d.envelope.notes += 'x'; } }; await change(mutations[label]); const html = success(check()); for (const name of labels) expect(html).toContain(name + ': ' + (name === label ? 'changed' : 'unchanged')); expect(html).toContain('Embedded CSV source bytes: equal'); expect(html).toContain('complete ordered arrays');
});
it('suppresses every review comparison when source bytes change even with matching local IDs and notes', async () => {
  await change(async d => { d.source.csv_text = d.source.csv_text.replace('28.6139', '28.6138'); d.source.sha256 = await flightCSVHash(d.source.csv_text); d.debrief.source_sha256 = d.source.sha256; }); const html = success(check()); expect(html).toContain('Source CSV bytes differ. Review sections NOT compared.'); for (const label of labels) expect(html).toContain(label + ': not compared, source changed'); expect(html).not.toContain(': unchanged</h3>'); expect(html).not.toContain(': changed</h3>'); expect(html).toContain('Source filename metadata: equal');
});
it('separates raw JSON bytes from validated content and exact private text changes', async () => {
  const raw = JSON.parse(text); await writeFile(right, JSON.stringify(Object.fromEntries(Object.entries(raw).reverse())) + '\n'); let html = success(check()); expect(html).toContain('Complete artifact bytes: different'); expect(html).toContain('Validated case content: equal'); expect(html).toContain('Analyst notes: unchanged'); await change(d => { d.review.notes += ' '; }); html = success(check()); expect(html).toContain('Analyst notes: changed');
});
it('shows source filename metadata separately and envelope removal without treating either as readiness', async () => {
  await change(d => { d.source.filename = 'PRIVATE-renamed.csv'; d.envelope = null; }); const html = success(check()); expect(html).toContain('Source filename metadata: different'); expect(html).toContain('Embedded CSV source bytes: equal'); expect(html).toContain('Analyst notes: unchanged'); expect(html).toContain('Envelope profile: changed'); expect(html).toContain('Envelope notes: changed');
});
it('pins each exact whole original independently with uppercase support and rejects source-only pin', async () => {
  const html = success(check('--expect-left-sha256', hash(text).toUpperCase())); expect(html.match(/Caller-supplied expected complete-case digest matched/g)).toHaveLength(1); expect(html.match(/No independent complete-case expectation supplied/g)).toHaveLength(1); success(check('--expect-left-sha256', hash(text), '--expect-right-sha256', hash(text))); failure(check('--expect-left-sha256', log.sha256)); await writeFile(right, text + '\n'); failure(check('--expect-right-sha256', hash(text)));
});
it.each(['source', 'marker', 'model', 'utf8', 'oversize', 'receipt'])('rejects %s originals before any partial HTML on either side', async kind => {
  const d = JSON.parse(text); if (kind === 'source') d.source.sha256 = 'a'.repeat(64); if (kind === 'marker') d.debrief.markers[0].time_s = 999; if (kind === 'model') d.replay_model = 'future'; const bytes = kind === 'utf8' ? Buffer.from([255]) : kind === 'oversize' ? 'x'.repeat(2 * 1024 * 1024 + 1) : kind === 'receipt' ? JSON.stringify({ format: 'skydash-review-case-revision-comparison-v1' }) : JSON.stringify(d); await writeFile(right, bytes); failure(check()); await writeFile(right, text); await writeFile(left, bytes); failure(check());
});
it('supports help and rejects malformed/duplicate/unknown pin options and missing or nonfile originals', () => {
  expect(run('--help').status).toBe(0); for (const args of [[], [left], [dir, right], [left, right, 'extra'], [left, right, '--expect-left-sha256', 'bad'], [left, right, '--expect-right-sha256'], [left, right, '--unknown', hash(text)], [left, right, '--expect-left-sha256', hash(text), '--expect-left-sha256', hash(text)]]) failure(run(...args));
});
