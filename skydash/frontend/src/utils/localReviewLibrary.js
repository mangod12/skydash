import { createReviewCase, readReviewCase, MAX_CASE_BYTES } from './reviewCase';
export const LIBRARY_VERSION = 'skydash-local-review-library-v1';
export const LIBRARY_LIMIT = 10;
export const LIBRARY_BYTES = 10 * 1024 * 1024;
const DB_NAME = 'skydash-private-review-library';
const STORE = 'cases';
export const LIBRARY_SCOPE = 'DEVICE-LOCAL CASE STORAGE. Saving keeps exact source coordinates and private review notes in this browser profile, accessible to others who use it and scripts on this site. Not encrypted, access-controlled team storage or a backup. No automatic save, upload or sharing. Browser clearing, private mode, storage eviction or a different device/site can remove or hide this library. Download JSON backups separately.';
function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Browser case storage is unavailable. Download review case JSON instead.')); return; }
    let request;
    try { request = globalThis.indexedDB.open(DB_NAME, 1); } catch { reject(new Error('Browser case storage is unavailable. Download review case JSON instead.')); return; }
    let abandoned = false;
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); if (abandoned) db.close(); else resolve(db); };
    request.onerror = () => reject(new Error('Browser case storage could not open. Existing files and current workspace are unchanged.'));
    request.onblocked = () => { abandoned = true; reject(new Error('Browser library upgrade is blocked by another SkyDash tab. Close other tabs or download JSON instead.')); };
  });
}
function recordValid(record) {
  return record && typeof record.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(record.id) && record.format === LIBRARY_VERSION && typeof record.contents === 'string' && new Blob([record.contents]).size <= MAX_CASE_BYTES && typeof record.title === 'string' && record.title.length <= 120 && typeof record.filename === 'string' && record.filename.length <= 120 && /^[a-f0-9]{64}$/.test(record.sha256) && typeof record.saved_at === 'string' && Number.isFinite(Date.parse(record.saved_at));
}
async function transaction(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx, result, reason;
    try { tx = db.transaction(STORE, mode); } catch { db.close(); reject(new Error('Browser library transaction could not start.')); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(reason || new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. No case was saved. Download JSON or delete a backed-up case.' : 'Browser library operation failed. No change was confirmed.')); };
    tx.onerror = () => { /* Transaction abort is the only failure closeout. */ };
    const fail = error => { reason = error; tx.abort(); };
    try { operation(tx.objectStore(STORE), value => { result = value; }, fail); } catch (error) { fail(error); }
  });
}
export async function listLocalCases() {
  return transaction('readonly', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => {
      const records = request.result;
      if (records.some(record => !recordValid(record))) { fail(new Error('Library contains unsupported or damaged records. Nothing was changed. Keep downloaded backups; do not clear browser data.')); return; }
      done(records.map(({ contents, ...metadata }) => ({ ...metadata, bytes: new Blob([contents]).size })).sort((a, b) => b.saved_at.localeCompare(a.saved_at) || a.id.localeCompare(b.id)));
    };
  });
}
export async function saveLocalCase(snapshot) {
  const contents = await createReviewCase(snapshot.log, snapshot.review, snapshot.debrief, snapshot.envelope);
  const opened = await readReviewCase(contents);
  const record = { id: globalThis.crypto.randomUUID(), format: LIBRARY_VERSION, title: opened.log.title, filename: opened.log.filename, sha256: opened.log.sha256, saved_at: new Date().toISOString(), contents };
  await transaction('readwrite', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => {
      const records = request.result;
      if (records.some(item => !recordValid(item))) { fail(new Error('Unsupported or damaged library records. Nothing was saved or replaced.')); return; }
      if (records.length >= LIBRARY_LIMIT) { fail(new Error('Library has 10 snapshots. Download and delete one before saving another. Nothing overwritten.')); return; }
      if (records.reduce((sum, item) => sum + new Blob([item.contents]).size, 0) + new Blob([contents]).size > LIBRARY_BYTES) { fail(new Error('Library exceeds its 10MiB content limit. Download and delete a backed-up case first. Nothing overwritten.')); return; }
      store.add(record); done({ ...record, contents: undefined });
    };
  });
  return { id: record.id, title: record.title, saved_at: record.saved_at };
}
export async function readLocalCase(id) {
  const record = await transaction('readonly', (store, done) => { const request = store.get(id); request.onsuccess = () => done(request.result); });
  if (!record) throw new Error('That local snapshot is no longer present. Refresh the library; current workspace unchanged.');
  if (!recordValid(record)) throw new Error('Local snapshot is unsupported or damaged. Nothing was opened.');
  const opened = await readReviewCase(record.contents);
  if (opened.log.sha256 !== record.sha256 || opened.log.title !== record.title || opened.log.filename !== record.filename) throw new Error('Local snapshot metadata does not match its case. Nothing was opened.');
  return { record, opened };
}
export async function deleteLocalCase(id) {
  return transaction('readwrite', (store, done, fail) => {
    const request = store.get(id); request.onsuccess = () => {
      if (!request.result) { fail(new Error('Snapshot no longer present. Refresh the library.')); return; }
      store.delete(id); done(id);
    };
  });
}
