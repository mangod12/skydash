import { createNotebookSourceBundle, readNotebookSourceBundle, MAX_NOTEBOOK_BUNDLE_BYTES } from './notebookSourceBundle';
export const NOTEBOOK_SHELF_VERSION = 'skydash-local-notebook-shelf-v1';
export const NOTEBOOK_SHELF_LIMIT = 10;
export const NOTEBOOK_SHELF_BYTES = 10 * 1024 * 1024;
const DB_NAME = 'skydash-private-notebook-shelf';
const STORE = 'bundles';
export const NOTEBOOK_SHELF_SCOPE = 'DEVICE-LOCAL NOTEBOOK BUNDLE STORAGE. An explicit save keeps the entire exact CSV, including outside-window coordinates/readings, and applied saved labels/private notes in this browser profile. Anyone using this profile and scripts on this site may access it. Not encrypted or access-controlled team storage, not a backup or signed training record. Browser clearing, private mode, storage eviction or another device/site can hide or remove it. No automatic save, upload or sharing. Download JSON backups separately.';
function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Browser notebook storage is unavailable. Download notebook source bundle JSON instead.')); return; }
    let request;
    try { request = globalThis.indexedDB.open(DB_NAME, 1); } catch { reject(new Error('Browser notebook storage is unavailable. Download notebook source bundle JSON instead.')); return; }
    let abandoned = false;
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); if (abandoned) db.close(); else resolve(db); };
    request.onerror = () => reject(new Error('Browser notebook storage could not open. Existing files and current workspace are unchanged.'));
    request.onblocked = () => { abandoned = true; reject(new Error('Browser notebook shelf upgrade is blocked by another SkyDash tab. Close other tabs or download JSON instead.')); };
  });
}
function recordValid(record) {
  return record && typeof record.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(record.id) && record.format === NOTEBOOK_SHELF_VERSION && typeof record.contents === 'string' && new Blob([record.contents]).size <= MAX_NOTEBOOK_BUNDLE_BYTES && typeof record.title === 'string' && record.title.length <= 120 && typeof record.filename === 'string' && record.filename.length <= 120 && /^[a-f0-9]{64}$/.test(record.sha256) && typeof record.saved_at === 'string' && Number.isFinite(Date.parse(record.saved_at));
}
async function transaction(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx, result, reason;
    try { tx = db.transaction(STORE, mode); } catch { db.close(); reject(new Error('Browser notebook shelf transaction could not start.')); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(reason || new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. No bundle was saved. Download JSON or delete a backed-up bundle.' : 'Browser notebook shelf operation failed. No change was confirmed.')); };
    tx.onerror = () => { /* Transaction abort is the only failure closeout. */ };
    const fail = error => { reason = error; tx.abort(); };
    try { operation(tx.objectStore(STORE), value => { result = value; }, fail); } catch (error) { fail(error); }
  });
}
export async function listNotebookBundles() {
  return transaction('readonly', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => {
      const records = request.result;
      if (records.some(record => !recordValid(record))) { fail(new Error('Notebook shelf contains unsupported or damaged records. Nothing was changed. Keep downloaded backups; do not clear browser data.')); return; }
      done(records.map(({ contents, ...metadata }) => ({ ...metadata, bytes: new Blob([contents]).size })).sort((a, b) => b.saved_at.localeCompare(a.saved_at) || a.id.localeCompare(b.id)));
    };
  });
}
export async function saveNotebookBundle(log, entries) {
  const contents = await createNotebookSourceBundle(log, entries);
  const opened = await readNotebookSourceBundle(contents);
  const record = { id: globalThis.crypto.randomUUID(), format: NOTEBOOK_SHELF_VERSION, title: opened.log.filename, filename: opened.log.filename, sha256: opened.log.sha256, saved_at: new Date().toISOString(), contents };
  await transaction('readwrite', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => {
      const records = request.result;
      if (records.some(item => !recordValid(item))) { fail(new Error('Unsupported or damaged notebook shelf records. Nothing was saved or replaced.')); return; }
      if (records.length >= NOTEBOOK_SHELF_LIMIT) { fail(new Error('Notebook shelf has 10 snapshots. Download and delete one before saving another. Nothing overwritten.')); return; }
      if (records.reduce((sum, item) => sum + new Blob([item.contents]).size, 0) + new Blob([contents]).size > NOTEBOOK_SHELF_BYTES) { fail(new Error('Notebook shelf exceeds its 10MiB content limit. Download and delete a backed-up bundle first. Nothing overwritten.')); return; }
      store.add(record); done({ ...record, contents: undefined });
    };
  });
  return { id: record.id, title: record.title, saved_at: record.saved_at };
}
export async function readNotebookBundle(id) {
  const record = await transaction('readonly', (store, done) => { const request = store.get(id); request.onsuccess = () => done(request.result); });
  if (!record) throw new Error('That local snapshot is no longer present. Refresh the notebook shelf; current workspace unchanged.');
  if (!recordValid(record)) throw new Error('Local snapshot is unsupported or damaged. Nothing was opened.');
  const opened = await readNotebookSourceBundle(record.contents);
  if (opened.log.sha256 !== record.sha256 || opened.log.filename !== record.title || opened.log.filename !== record.filename) throw new Error('Local snapshot metadata does not match its bundle. Nothing was opened.');
  return { record, opened };
}
export async function deleteNotebookBundle(id) {
  return transaction('readwrite', (store, done, fail) => {
    const request = store.get(id); request.onsuccess = () => {
      if (!request.result) { fail(new Error('Snapshot no longer present. Refresh the notebook shelf.')); return; }
      store.delete(id); done(id);
    };
  });
}
