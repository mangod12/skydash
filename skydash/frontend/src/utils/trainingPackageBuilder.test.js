import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { buildTrainingPackageManifest, checkPackageSelection } from './trainingPackageBuilder';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, LOG_VERSION, parseFlightCSV, flightCSVHash } from './flightLog';
let log, text;
const file = (name, value) => { const bytes = new TextEncoder().encode(value); return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer }; };
beforeEach(async () => { vi.stubGlobal('crypto', webcrypto); log = { filename: 'PRIVATE.csv', title: 'PRIVATE', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) }; text = await createReviewCase(log, { title: 'PRIVATE', notes: 'PRIVATE notes' }, { markers: [], notes: '' }, null); });
afterEach(() => vi.unstubAllGlobals());
it('checks mixed original kinds and preserves exact raw bytes and list order in an explicitv2 manifest', async () => {
  const notebook = await createNotebookSourceBundle(log, [{ id: 'x', first_row: 2, last_row: 3, label: 'PRIVATE', notes: '' }]), paired = await createPairedReviewBundle({ log, review: { title: 'PRIVATE', notes: '' }, debrief: { markers: [], notes: '' }, envelope: null }, { baseline: log, notes: '', alignment: null });
  const items = [{ kind: 'case', file: file('case.json', text + '\n') }, { kind: 'notebook', file: file('notebook.json', notebook) }, { kind: 'paired', file: file('paired.json', paired) }]; const result = await buildTrainingPackageManifest(items); expect(result.format).toBe('skydash-training-intake-manifest-v2'); expect(result.bundles.map(item => item.kind)).toEqual(['case', 'notebook', 'paired']); expect(result.bundles.map(item => item.path)).toEqual(['case.json', 'notebook.json', 'paired.json']); expect(result.bundles[0].sha256).toBe(await flightCSVHash(text + '\n')); expect(result.bundles[0].sha256).not.toBe(log.sha256); expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect(Object.keys(result)).toEqual(['format', 'bundles']);
});
it('refuses incorrect explicit kind, corrupt nested source/review and malformed JSON/UTF8 without a manifest', async () => {
  await expect(buildTrainingPackageManifest([{ kind: 'notebook', file: file('case.json', text) }])).rejects.toThrow();
  for (const change of [raw => { raw.source.sha256 = 'a'.repeat(64); }, raw => { raw.replay_model = 'future'; }, raw => { raw.extra = 'PRIVATE'; }]) { const raw = JSON.parse(text); change(raw); await expect(buildTrainingPackageManifest([{ kind: 'case', file: file('case.json', JSON.stringify(raw)) }])).rejects.toThrow(); }
  await expect(buildTrainingPackageManifest([{ kind: 'case', file: file('bad.json', 'PRIVATE malformed') }])).rejects.toThrow(); await expect(buildTrainingPackageManifest([{ kind: 'case', file: { name: 'bad.json', size: 1, arrayBuffer: async () => new Uint8Array([255]).buffer } }])).rejects.toThrow();
});
it('checks entire selection limits and names before reading any file and never infers kind from filename', async () => {
  const read = vi.fn(), valid = { kind: 'case', file: { name: 'valid.json', size: 1, arrayBuffer: read } };
  for (const items of [[], Array.from({ length: 21 }, (_, i) => ({ ...valid, file: { ...valid.file, name: i + '.json' } })), [valid, valid], [{ ...valid, kind: 'unknown' }], [{ ...valid, kind: '__proto__' }], ...['../a', 'a/b', 'a\\b', '.', '..', '', 'x'.repeat(241)].map(name => [{ ...valid, file: { ...valid.file, name } }] ), [{ ...valid, file: { ...valid.file, size: 2 * 1024 * 1024 + 1 } }], Array.from({ length: 6 }, (_, i) => ({ kind: 'paired', file: { name: i + '.json', size: 4 * 1024 * 1024, arrayBuffer: read } }))]) await expect(buildTrainingPackageManifest(items)).rejects.toThrow();
  expect(read).not.toHaveBeenCalled(); expect(() => checkPackageSelection([valid])).not.toThrow();
});
it('rejects changed reads and late invalid artifacts rather than returning partial bundles', async () => {
  await expect(buildTrainingPackageManifest([{ kind: 'case', file: file('good.json', text) }, { kind: 'case', file: file('late.json', 'PRIVATE malformed') }])).rejects.toThrow(); await expect(buildTrainingPackageManifest([{ kind: 'case', file: { ...file('case.json', text), size: 1 } }])).rejects.toThrow();
});
