import { followupPacket, readFollowupPacket, FOLLOWUP_BYTES } from './debriefFollowup';
export const SHELF_VERSION = 'skydash-followup-shelf-v1';
export const SHELF_LIMIT = 10;
export const SHELF_BYTES = 2 * 1024 * 1024;
const SHELF_DB = 'skydash-private-followup-shelf';
const SHELF_STORE = 'packets';
export const SHELF_SCOPE = 'EXPLICIT DEVICE-LOCAL FOLLOW-UP STORAGE. Stores private action/owner/target/closure/checklist text and exact source fingerprint in this browser profile, not the CSV or coordinate fields. Annotations may themselves mention sensitive people/places. Anyone using this profile and scripts on this site may access them. Not encrypted team storage, access control or a backup. Browser clearing, eviction, private mode or another device/site can lose or hide records. Keep downloaded packet JSON and exact CSV separately. No automatic reads, saves, uploads or sharing.';
function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Browser follow-up storage is unavailable. Download follow-up packet JSON instead.')); return; }
    let request;
    try { request = globalThis.indexedDB.open(SHELF_DB, 1); } catch { reject(new Error('Browser follow-up storage is unavailable. Download follow-up packet JSON instead.')); return; }
    let abandoned = false;
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(SHELF_STORE)) request.result.createObjectStore(SHELF_STORE, { keyPath: 'id' }); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); if (abandoned) db.close(); else resolve(db); };
    request.onerror = () => reject(new Error('Browser follow-up storage could not open. Existing files and current workspace are unchanged.'));
    request.onblocked = () => { abandoned = true; reject(new Error('Browser shelf upgrade is blocked by another SkyDash tab. Close other tabs or download JSON instead.')); };
  });
}
async function transaction(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx, result, reason;
    try { tx = db.transaction(SHELF_STORE, mode); } catch { db.close(); reject(new Error('Browser follow-up shelf transaction could not start.')); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(reason || new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. No packet was saved. Download JSON or delete a backed-up packet.' : 'Browser follow-up shelf operation failed. No change was confirmed.')); };
    tx.onerror = () => { /* Transaction abort is the only failure closeout. */ };
    const fail = error => { reason = error; tx.abort(); };
    try { operation(tx.objectStore(SHELF_STORE), value => { result = value; }, fail); } catch (error) { fail(error); }
  });
}
function valid(record) {
  const keys = ['id', 'format', 'label', 'sha256', 'saved_at', 'contents'];
  return record && typeof record === 'object' && Object.keys(record).sort().join(',') === keys.sort().join(',') && typeof record.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(record.id) && record.format === SHELF_VERSION && typeof record.label === 'string' && Boolean(record.label.trim()) && record.label.length <= 120 && typeof record.sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.sha256) && typeof record.contents === 'string' && new Blob([record.contents]).size <= FOLLOWUP_BYTES && typeof record.saved_at === 'string' && Number.isFinite(Date.parse(record.saved_at));
}
const metadata = ({ contents, ...record }) => ({ ...record, bytes: new Blob([contents]).size });
export async function listFollowupShelf() {
  return transaction('readonly', (store, done, fail) => { const request = store.getAll(); request.onsuccess = () => { if (request.result.some(record => !valid(record))) { fail(new Error('Unsupported or damaged follow-up shelf records. Nothing changed. Keep downloaded backups.')); return; } done(request.result.map(metadata).sort((a, b) => b.saved_at.localeCompare(a.saved_at) || a.id.localeCompare(b.id))); }; });
}
export async function saveFollowupShelf(log, snapshot, label) {
  if (typeof label !== 'string' || !label.trim() || label.length > 120) throw new Error('Snapshot label required, at most 120 characters.');
  const data = followupPacket(log, snapshot.actions, snapshot.checklist), contents = JSON.stringify(data, null, 2);
  const record = { id: globalThis.crypto.randomUUID(), format: SHELF_VERSION, label: label.trim(), sha256: log.sha256, saved_at: new Date().toISOString(), contents };
  return transaction('readwrite', (store, done, fail) => {
    const request = store.getAll(); request.onsuccess = () => {
      const records = request.result;
      if (records.some(record => !valid(record))) { fail(new Error('Unsupported or damaged shelf records. No packet saved or replaced.')); return; }
      if (records.length >= SHELF_LIMIT) { fail(new Error('Shelf has 10 snapshots. Download and delete a backed-up snapshot first. Nothing overwritten.')); return; }
      if (records.reduce((sum, record) => sum + new Blob([record.contents]).size, 0) + new Blob([contents]).size > SHELF_BYTES) { fail(new Error('Shelf exceeds 2MiB content limit. Nothing saved or overwritten.')); return; }
      store.add(record); done(metadata(record));
    };
  });
}
export async function readFollowupShelf(id, log) {
  const record = await transaction('readonly', (store, done) => { const request = store.get(id); request.onsuccess = () => done(request.result); });
  if (!record) throw new Error('Follow-up snapshot no longer present. Refresh shelf. Current reviews unchanged.');
  if (!valid(record)) throw new Error('Unsupported or damaged snapshot. Nothing opened.');
  // Every field is validated against currently loaded exact source, even when metadata claims a match.
  const data = readFollowupPacket(record.contents, log);
  if (record.sha256 !== data.source_sha256) throw new Error('Stored metadata does not match packet. Nothing opened.');
  return { record, data };
}
export async function deleteFollowupShelf(id) {
  return transaction('readwrite', (store, done, fail) => { const request = store.get(id); request.onsuccess = () => { if (!request.result) { fail(new Error('Snapshot no longer present. Refresh shelf.')); return; } store.delete(id); done(id); }; });
}
