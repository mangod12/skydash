import { spawnSync } from 'node:child_process';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTrainingExample } from '../../scripts/create-training-example.mjs';
import { reportTrainingAgenda } from '../../scripts/report-training-agenda.mjs';
import { browserTrainingAgenda } from './browserTrainingAgenda';
import { browserTrainingArchive } from './browserTrainingArchive';
import { agendaBrowserTrainingArchive } from './checkBrowserTrainingArchive';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: vi.fn(async () => bytes) });
let dir, files, manifest, entries;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = join(await mkdtemp(join(tmpdir(), 'skydash-agenda-')), 'kit'); await createTrainingExample(dir);
  files = await Promise.all(['case.json', 'notebook.json', 'paired.json'].map(async name => file(name, await readFile(join(dir, name)))));
  for (const index of [0, 2]) {
    const data = JSON.parse(Buffer.from(await files[index].arrayBuffer()).toString()), primary = index === 0 ? data : data.primary_case;
    primary.debrief.markers = [
      { id: 'private-q', time_s: 4, kind: 'Question', text: 'PRIVATE-QUESTION <img src=x> & </p>', discussed: false },
      { id: 'private-f', time_s: 8, kind: 'Follow-up', text: 'PRIVATE-FOLLOWUP', discussed: false },
      { id: 'private-o', time_s: 0, kind: 'Observation', text: 'EXCLUDED-OBSERVATION', discussed: false },
      { id: 'private-d', time_s: 12, kind: 'Question', text: 'EXCLUDED-DISCUSSED', discussed: true }
    ]; primary.debrief.notes = 'EXCLUDED-SUMMARY'; primary.review.notes = 'EXCLUDED-ANALYST';
    files[index] = file(files[index].name, Buffer.from(JSON.stringify(data)));
  }
  entries = files.map((f, i) => ({ kind: ['case', 'notebook', 'paired'][i], path: f.name, sha256: hash(Buffer.from([])) }));
  await save();
});
async function save() { for (const [i, f] of files.entries()) { entries[i].sha256 = hash(await f.arrayBuffer()); await writeFile(join(dir, f.name), await f.arrayBuffer()); } manifest = file('training.json', Buffer.from(JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: entries }))); await writeFile(join(dir, manifest.name), await manifest.arrayBuffer()); for (const f of [manifest, ...files]) f.arrayBuffer.mockClear(); }
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('fresh mixed agenda preserves original and chronological positions, escapes note text and omits unrelated private fields', async () => {
  const result = await browserTrainingAgenda(manifest, files, { includePrivateReview: true });
  expect(result.bundleCount).toBe(3); for (const value of ['Original 1: case', 'Original 2: notebook', 'Original 3: paired', 'PRIVATE-QUESTION &lt;img src=x&gt; &amp; &lt;/p&gt;', 'PRIVATE-FOLLOWUP', '2 eligible markers in this original', '1 marked discussed', '1 undiscussed Observation', 'timeline position 2', 'Not applicable', 'No independent manifest expectation', 'not a queue of verified obligations']) expect(result.html).toContain(value);
  for (const secret of ['EXCLUDED-OBSERVATION', 'EXCLUDED-DISCUSSED', 'EXCLUDED-SUMMARY', 'EXCLUDED-ANALYST', 'private-q', 'case.json', 'notebook.json', '28.6139', '77.209', '<img', '<script']) expect(result.html).not.toContain(secret);
  expect(result.html.indexOf('Question at 4')).toBeLessThan(result.html.indexOf('Follow-up at 8')); expect(Object.keys(result)).toEqual(['html', 'digest', 'bundleCount']);
});
it('CLI and received ZIP independently recheck originals and produce identical bounded HTML without Buffer in browser', async () => {
  const pin = hash(await manifest.arrayBuffer()), options = { includePrivateReview: true, expectedSha256: pin.toUpperCase() }, expected = await reportTrainingAgenda(join(dir, manifest.name), options);
  const archive = await browserTrainingArchive(manifest, files, { includeSensitiveOriginals: true });
  let result; const previous = globalThis.Buffer; try { globalThis.Buffer = undefined; result = await agendaBrowserTrainingArchive(file('PRIVATE.zip', archive.bytes), { includePrivateReview: true, expectedManifestSha256: pin.toUpperCase(), expectedArchiveSha256: hash(archive.bytes) }); } finally { globalThis.Buffer = previous; }
  expect(result.html).toBe(expected); expect(result.archiveDigest).toBe(hash(archive.bytes)); expect(result.manifestDigest).toBe(pin); expect(result.html).not.toMatch(/<script|<img|<iframe|<link/); expect(Object.keys(result)).toEqual(['html', 'archiveDigest', 'manifestDigest', 'bundleCount']);
});
it('strict private consent is required before any read; invalid independent pin and receipt input refuse', async () => {
  for (const includePrivateReview of [false, undefined, 1, 'true']) { await expect(browserTrainingAgenda(manifest, files, { includePrivateReview })).rejects.toThrow('Explicit private'); await expect(agendaBrowserTrainingArchive(manifest, { includePrivateReview })).rejects.toThrow('Explicit private'); }
  expect(manifest.arrayBuffer).not.toHaveBeenCalled(); await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true, expectedSha256: 'a'.repeat(64) })).rejects.toThrow();
  await expect(browserTrainingAgenda(file('receipt.json', Buffer.from('{}')), files, { includePrivateReview: true })).rejects.toThrow();
});
it('empty eligible set is explicit and notebook-only package is not treated as completed work', async () => {
  const data = JSON.parse(Buffer.from(await files[0].arrayBuffer()).toString()); data.debrief.markers = []; files = [file('case.json', Buffer.from(JSON.stringify(data)))]; entries = entries.slice(0, 1); await save();
  expect((await browserTrainingAgenda(manifest, files, { includePrivateReview: true })).html).toContain('No Question or Follow-up marker is currently marked undiscussed');
  files = [file('notebook.json', await readFile(join(dir, 'notebook.json')))]; entries = [{ kind: 'notebook', path: 'notebook.json' }]; await save(); expect((await browserTrainingAgenda(manifest, files, { includePrivateReview: true })).html).toContain('Not applicable');
});
it('invalid otherwise omitted notebook, late nested source and changed file bytes refuse all output', async () => {
  const bad = JSON.parse(Buffer.from(await files[1].arrayBuffer()).toString()); bad.source.sha256 = 'a'.repeat(64); files[1] = file('notebook.json', Buffer.from(JSON.stringify(bad))); await save(); await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true })).rejects.toThrow();
});
it('repeated originals remain independent chapters with no combined task total or deduplication', async () => {
  files = [files[0], { ...files[0], name: 'repeat.json' }]; entries = [{ kind: 'case', path: 'case.json' }, { kind: 'case', path: 'repeat.json' }]; await save();
  const { html } = await browserTrainingAgenda(manifest, files, { includePrivateReview: true }); expect(html.match(/2 eligible markers in this original/g)).toHaveLength(2); expect(html).toContain('Original 2: case'); expect(html).not.toContain('4 eligible markers');
});
it('manifest and original re-reads cannot silently change the checked selection or private annotations', async () => {
  const raw = await manifest.arrayBuffer(); manifest.arrayBuffer.mockResolvedValueOnce(raw).mockResolvedValueOnce(Buffer.from('{}')); await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true })).rejects.toThrow('Changed complete manifest');
  manifest.arrayBuffer.mockResolvedValue(raw); const original = await files[0].arrayBuffer(); files[0].arrayBuffer.mockResolvedValueOnce(original).mockResolvedValueOnce(Buffer.from('{}')); await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true })).rejects.toThrow();
});

it('bounds escaped private expansion across repeated originals before returning any HTML', async () => {
  const data = JSON.parse(Buffer.from(await files[0].arrayBuffer()).toString());
  data.debrief.markers = Array.from({ length: 100 }, (_, i) => ({ id: 'm' + i, time_s: 0, kind: 'Question', text: '&'.repeat(1000), discussed: false }));
  const bytes = Buffer.from(JSON.stringify(data)); files = Array.from({ length: 20 }, (_, i) => file('copy' + i + '.json', bytes)); entries = files.map(f => ({ kind: 'case', path: f.name })); await save();
  await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true })).rejects.toThrow('output exceeds bound');
});

it('CLI refuses missing consent, repeated flags, invalid expectations, symlinks and outside paths without private stdout or writes', async () => {
  const script = join(process.cwd(), 'scripts', 'report-training-agenda.mjs'), path = join(dir, 'training.json'), before = await readdir(dir);
  for (const args of [[path], [path, '--include-private-review', '--include-private-review'], [path, '--include-private-review', '--expect-sha256', 'bad'], [path, '--include-private-review', '--expect-sha256', 'a'.repeat(64)]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }); expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain(dir); expect(result.stderr).not.toContain('PRIVATE-QUESTION');
  }
  expect(await readdir(dir)).toEqual(before);
  await symlink(join(dir, 'case.json'), join(dir, 'linked.json')); entries[0].path = 'linked.json'; manifest = file('training.json', Buffer.from(JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: entries }))); await writeFile(path, await manifest.arrayBuffer());
  await expect(reportTrainingAgenda(path, { includePrivateReview: true })).rejects.toThrow();
  entries[0].path = '../outside.json'; await writeFile(path, JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: entries })); await expect(reportTrainingAgenda(path, { includePrivateReview: true })).rejects.toThrow();
});
it('an invalid late paired original refuses even when its own agenda would be empty', async () => {
  const data = JSON.parse(Buffer.from(await files[2].arrayBuffer()).toString()); data.primary_case.debrief.markers = []; data.comparison.baseline.sha256 = 'a'.repeat(64); files[2] = file('paired.json', Buffer.from(JSON.stringify(data))); await save();
  await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true })).rejects.toThrow();
});

it('even excluded notebook bytes must remain identical on the post-validation re-read', async () => {
  const original = await files[1].arrayBuffer(); files[1].arrayBuffer.mockResolvedValueOnce(original).mockResolvedValueOnce(Buffer.from('{}'));
  await expect(browserTrainingAgenda(manifest, files, { includePrivateReview: true })).rejects.toThrow('Changed complete original bytes');
});
