import { LOG_VERSION } from './flightLog';
import { WINDOW_VERSION, reviewWindow } from './reviewWindow';
export const NOTEBOOK_VERSION = 'skydash-window-notebook-v1';
export const MAX_NOTEBOOK_WINDOWS = 20;
export const MAX_NOTEBOOK_BYTES = 384 * 1024;
const exact = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...fields].sort().join(',');
export function validateWindowEntries(log, entries) {
  if (log?.model_version !== LOG_VERSION || !/^[a-f0-9]{64}$/.test(log.sha256)) throw new Error('Load a supported exact source before using the notebook.');
  if (!Array.isArray(entries) || entries.length > MAX_NOTEBOOK_WINDOWS) throw new Error('At most 20 saved review windows are supported.');
  const ids = new Set();
  return entries.map(entry => {
    if (!exact(entry, ['id', 'first_row', 'last_row', 'label', 'notes']) || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) || ids.has(entry.id)) throw new Error('Invalid window fields or duplicate window identity.');
    ids.add(entry.id); reviewWindow(log, entry.first_row - 1, entry.last_row - 1, entry.label, entry.notes);
    if (!Number.isInteger(entry.first_row) || !Number.isInteger(entry.last_row)) throw new Error('Saved window rows must be whole numbers.');
    return { ...entry };
  });
}
export function windowNotebook(log, entries) {
  const data = { format: NOTEBOOK_VERSION, replay_model: LOG_VERSION, window_model: WINDOW_VERSION, source_sha256: log.sha256, windows: validateWindowEntries(log, entries) };
  if (new Blob([JSON.stringify(data, null, 2)]).size > MAX_NOTEBOOK_BYTES) throw new Error('Window notebook exceeds 384KiB. Shorten notes before exporting.');
  return data;
}
export function readWindowNotebook(text, log) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_NOTEBOOK_BYTES) throw new Error('Window notebook must be at most 384KiB.');
  let data; try { data = JSON.parse(text); } catch { throw new Error('Window notebook is not valid JSON.'); }
  if (!exact(data, ['format', 'replay_model', 'window_model', 'source_sha256', 'windows']) || data.format !== NOTEBOOK_VERSION || data.replay_model !== LOG_VERSION || data.window_model !== WINDOW_VERSION) throw new Error('Unsupported window notebook fields or model.');
  if (data.source_sha256 !== log.sha256) throw new Error('Source fingerprint mismatch. Load the exact matching CSV before opening its notebook.');
  return windowNotebook(log, data.windows);
}
export function addReviewedWindow(log, entries, result, id) {
  if (!result) throw new Error('Review a window before saving it to the notebook.');
  return validateWindowEntries(log, [...entries, { id, first_row: result.first + 1, last_row: result.last + 1, label: result.label, notes: result.notes }]);
}
