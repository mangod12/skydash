import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { actionRegister } from './debriefActions';
import { checklistReview } from './debriefChecklist';
import { followupPacket } from './debriefFollowup';
import { SHELF_VERSION, listFollowupShelf, saveFollowupShelf, readFollowupShelf, deleteFollowupShelf } from './followupShelf';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const snapshot = { actions: actionRegister(log, [{ id: 'a', row: 4, text: 'Private action', owner: '', target: '', status: 'Open', closure: '' }]), checklist: checklistReview(log, 'Private title', []) };
const record = () => ({ id: 'stored-one', format: SHELF_VERSION, label: 'Stored packet', sha256: log.sha256, saved_at: '2026-11-19T00:00:00.000Z', contents: JSON.stringify(followupPacket(log, snapshot.actions, snapshot.checklist)) });
// Minimal transaction harness exercises operation callbacks and commit/abort boundaries; browser E2E covers real IndexedDB reload.
function storage(initial = [], options = {}) {
  const records = new Map(initial.map(record => [record.id, structuredClone(record)]));
  vi.stubGlobal('indexedDB', { open() {
    const open = {};
    queueMicrotask(() => { const db = { close: vi.fn(), objectStoreNames: { contains: () => true }, transaction() {
      let aborted = false, scheduled = false; const changes = new Map(records); const tx = { abort() { aborted = true; queueMicrotask(() => tx.onabort()); }, objectStore() { return store; } };
      const finish = () => { if (!scheduled) { scheduled = true; queueMicrotask(() => { if (aborted) return; if (options.quota) { tx.error = { name: 'QuotaExceededError' }; tx.onabort(); return; } records.clear(); for (const [key, value] of changes) records.set(key, value); tx.oncomplete(); }); } };
      const request = value => { const req = { result: structuredClone(value) }; queueMicrotask(() => { if (!aborted) req.onsuccess(); finish(); }); return req; };
      const store = { getAll: () => request([...changes.values()]), get: id => request(changes.get(id)), add: value => { changes.set(value.id, structuredClone(value)); }, delete: id => changes.delete(id) }; return tx;
    } }; open.result = db; open.onsuccess(); }); return open;
  } }); return records;
}
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('indexedDB', undefined); }); afterEach(() => vi.unstubAllGlobals());
describe('explicit private follow-up snapshot storage', () => {
  it.each([() => listFollowupShelf(), () => saveFollowupShelf(log, snapshot, 'Label'), () => readFollowupShelf('id', log), () => deleteFollowupShelf('id')])('reports unavailable storage, never claims saved', async operation => { await expect(operation()).rejects.toThrow('unavailable'); });
  it('validates label/current source before opening any database', async () => { const open = vi.fn(); vi.stubGlobal('indexedDB', { open }); await expect(saveFollowupShelf(log, snapshot, '')).rejects.toThrow('label'); await expect(saveFollowupShelf({ ...log, sha256: 'b'.repeat(64) }, snapshot, 'Title')).rejects.toThrow('fingerprint'); expect(open).not.toHaveBeenCalled(); });
  it('handles denied/error/blocked open and closes late connection', async () => {
    vi.stubGlobal('indexedDB', { open() { throw Error('denied'); } }); await expect(listFollowupShelf()).rejects.toThrow('unavailable'); let request = {}; vi.stubGlobal('indexedDB', { open() { queueMicrotask(() => request.onerror()); return request; } }); await expect(listFollowupShelf()).rejects.toThrow('could not open'); const close = vi.fn(); request = { result: { close } }; vi.stubGlobal('indexedDB', { open() { queueMicrotask(() => request.onblocked()); return request; } }); await expect(listFollowupShelf()).rejects.toThrow('blocked'); request.onsuccess(); expect(close).toHaveBeenCalled();
  });
  it('saves new immutable snapshots, lists metadata only and reads exact validated packet', async () => { const records = storage(); const first = await saveFollowupShelf(log, snapshot, ' First '); const second = await saveFollowupShelf(log, snapshot, 'Second'); expect(first.id).not.toBe(second.id); expect(records.size).toBe(2); expect(first.label).toBe('First'); const list = await listFollowupShelf(); expect(list).toHaveLength(2); expect(list[0].contents).toBeUndefined(); expect(list[0].bytes).toBeGreaterThan(0); const opened = await readFollowupShelf(first.id, log); expect(opened.data.actions).toEqual(snapshot.actions); expect(opened.record.contents).not.toContain('csv_text'); });
  it('caps10 without overwriting/pruning and quota abort never commits', async () => { const initial = Array.from({ length: 10 }, (_, i) => ({ ...record(), id: 'r' + i })); const records = storage(initial); await expect(saveFollowupShelf(log, snapshot, 'Extra')).rejects.toThrow('10 snapshots'); expect(records.size).toBe(10); const empty = storage([], { quota: true }); await expect(saveFollowupShelf(log, snapshot, 'Quota')).rejects.toThrow('full'); expect(empty.size).toBe(0); });
  it('enforces2MiB aggregate content limit before add', async () => { const initial = Array.from({ length: 5 }, (_, i) => ({ ...record(), id: 'r' + i, contents: ' '.repeat(430000) })); const records = storage(initial); await expect(saveFollowupShelf(log, snapshot, 'Extra')).rejects.toThrow('2MiB'); expect(records.size).toBe(5); });
  it('rejects damaged metadata/contents/wrong sources and never partially applies or deletes', async () => { let records = storage([{ ...record(), extra: true }]); await expect(listFollowupShelf()).rejects.toThrow('damaged'); await expect(saveFollowupShelf(log, snapshot, 'Label')).rejects.toThrow('damaged'); expect(records.size).toBe(1); storage([record()]); await expect(readFollowupShelf('stored-one', { ...log, sha256: 'b'.repeat(64) })).rejects.toThrow('fingerprint'); records = storage([{ ...record(), contents: '{' }]); await expect(readFollowupShelf('stored-one', log)).rejects.toThrow('valid JSON'); expect(records.size).toBe(1); storage([{ ...record(), sha256: 'b'.repeat(64) }]); await expect(readFollowupShelf('stored-one', log)).rejects.toThrow('metadata'); });
  it('deletes only chosen local record and errors if already absent', async () => { const records = storage([record(), { ...record(), id: 'other' }]); await expect(deleteFollowupShelf('stored-one')).resolves.toBe('stored-one'); expect(records.has('other')).toBe(true); expect(records.size).toBe(1); await expect(readFollowupShelf('stored-one', log)).rejects.toThrow('no longer'); await expect(deleteFollowupShelf('stored-one')).rejects.toThrow('no longer'); });
});
