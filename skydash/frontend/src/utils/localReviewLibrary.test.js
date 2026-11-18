import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV, flightCSVHash } from './flightLog';
import { listLocalCases, saveLocalCase, readLocalCase, deleteLocalCase } from './localReviewLibrary';
let snapshot;
beforeEach(async () => { vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('indexedDB', undefined); snapshot = { log: { filename: 'test.csv', csv_text: SAMPLE_LOG, samples: parseFlightCSV(SAMPLE_LOG), sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION }, review: { title: 'Synthetic', notes: '' }, debrief: { markers: [], notes: '' }, envelope: null }; });
afterEach(() => vi.unstubAllGlobals());
describe('browser storage failures preserve review state', () => {
  it.each([() => listLocalCases(), () => saveLocalCase(snapshot), () => readLocalCase('one'), () => deleteLocalCase('one')])('reports unsupported IndexedDB rather than claiming persistence', async operation => { await expect(operation()).rejects.toThrow('unavailable'); });
  it('validates current source before opening any storage transaction', async () => {
    const open = vi.fn(); vi.stubGlobal('indexedDB', { open }); snapshot.log.sha256 = 'b'.repeat(64); await expect(saveLocalCase(snapshot)).rejects.toThrow('fingerprint'); expect(open).not.toHaveBeenCalled();
  });
  it('handles a browser denying open synchronously', async () => { vi.stubGlobal('indexedDB', { open() { throw Error('SecurityError'); } }); await expect(listLocalCases()).rejects.toThrow('unavailable'); });
  it('handles blocked upgrades and closes a connection that arrives after rejection', async () => {
    const close = vi.fn(); const request = { result: { close, objectStoreNames: { contains: () => true } } }; vi.stubGlobal('indexedDB', { open() { queueMicrotask(() => request.onblocked()); return request; } }); await expect(listLocalCases()).rejects.toThrow('blocked'); request.onsuccess(); expect(close).toHaveBeenCalledOnce();
  });
  it('does not create a store or mutate data on ordinary open error', async () => { const request = {}; vi.stubGlobal('indexedDB', { open() { queueMicrotask(() => request.onerror()); return request; } }); await expect(listLocalCases()).rejects.toThrow('could not open'); });
  it('handles a database connection that cannot start a transaction', async () => { const close = vi.fn(); const request = { result: { close, transaction() { throw Error('closed'); } } }; vi.stubGlobal('indexedDB', { open() { queueMicrotask(() => request.onsuccess()); return request; } }); await expect(listLocalCases()).rejects.toThrow('could not start'); expect(close).toHaveBeenCalledOnce(); });
});
