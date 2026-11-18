import { LOG_VERSION, MAX_LOG_BYTES, parseFlightCSV, flightCSVHash, flightAfterAction } from './flightLog';
import { debriefSidecar, readDebriefSidecar, instructorReport } from './instructorDebrief';
import { ENVELOPE_VERSION, validateEnvelope, envelopeReport } from './trainingEnvelope';
export const REVIEW_CASE_VERSION = 'skydash-review-case-v1';
export const MAX_CASE_BYTES = 2 * 1024 * 1024;
export const CASE_SCOPE = 'PORTABLE LOCAL REVIEW, NOT A SIGNED TRAINING RECORD. Includes exact source coordinates and private review notes. No automatic upload or sharing. Fingerprints detect source-byte differences, not authenticity, authorship or tamper-evident custody. Opening a case replaces the current local source and review, never backend records. Comparison baseline and comparison notes are not included.';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
function checkedEnvelope(value) {
  if (value === null) return null;
  if (!exact(value, ['profile', 'notes']) || !text(value.notes, 4000)) throw new Error('Invalid case envelope review fields or notes.');
  return { profile: validateEnvelope(value.profile), notes: value.notes };
}
async function checkedCase(data) {
  if (!exact(data, ['format', 'replay_model', 'envelope_model', 'source', 'review', 'debrief', 'envelope']) || data.format !== REVIEW_CASE_VERSION || data.replay_model !== LOG_VERSION || data.envelope_model !== ENVELOPE_VERSION) throw new Error('Unsupported review case format or replay model.');
  if (!exact(data.source, ['filename', 'csv_text', 'sha256']) || !text(data.source.filename, 120, true) || !text(data.source.sha256, 64) || !/^[a-f0-9]{64}$/.test(data.source.sha256)) throw new Error('Invalid case source metadata.');
  if (typeof data.source.csv_text !== 'string' || new Blob([data.source.csv_text]).size > MAX_LOG_BYTES) throw new Error('Case source CSV must be at most 1MiB.');
  if (!exact(data.review, ['title', 'notes']) || !text(data.review.title, 120, true) || !text(data.review.notes, 4000)) throw new Error('Case title is required (up to 120 characters); analyst notes up to 4,000 characters.');
  const samples = parseFlightCSV(data.source.csv_text);
  if (await flightCSVHash(data.source.csv_text) !== data.source.sha256) throw new Error('Case source fingerprint mismatch. Nothing was opened.');
  const log = { ...data.source, ...data.review, samples, model_version: LOG_VERSION };
  const debrief = readDebriefSidecar(JSON.stringify(data.debrief), log);
  const envelope = checkedEnvelope(data.envelope);
  return { data: { ...data, debrief, envelope }, log };
}
export async function createReviewCase(log, review, debrief, envelope) {
  if (!log || log.model_version !== LOG_VERSION) throw new Error('Load a supported source before exporting a case.');
  const data = { format: REVIEW_CASE_VERSION, replay_model: LOG_VERSION, envelope_model: ENVELOPE_VERSION,
    source: { filename: log.filename, csv_text: log.csv_text, sha256: log.sha256 }, review,
    debrief: debriefSidecar(log, debrief.markers, debrief.notes), envelope: checkedEnvelope(envelope) };
  const checked = await checkedCase(data);
  const contents = JSON.stringify(checked.data, null, 2);
  if (new Blob([contents]).size > MAX_CASE_BYTES) throw new Error('Review case exceeds 2MiB. Export source and reviews separately.');
  return contents;
}
export async function readReviewCase(contents) {
  if (typeof contents !== 'string' || new Blob([contents]).size > MAX_CASE_BYTES) throw new Error('Review case JSON must be at most 2MiB.');
  let data; try { data = JSON.parse(contents); } catch { throw new Error('Review case is not valid JSON.'); }
  return checkedCase(data);
}
export function reviewCaseReport(opened) {
  const { log, data } = opened;
  return ['SKYDASH / PORTABLE REVIEW CASE', CASE_SCOPE, '', `Case format: ${REVIEW_CASE_VERSION}`, 'All observations and review results below are recomputed locally, not accepted as imported report text.', '', flightAfterAction(log), '', instructorReport(log, data.debrief.markers, data.debrief.notes), '', data.envelope ? envelopeReport(log, data.envelope.profile, data.envelope.notes) : 'No evaluated envelope profile included.', '', 'EXCLUDED: comparison baseline, comparison notes, replay cursor, unadded marker draft, unevaluated criteria, aircraft commands and backend record identity. Reports are not certificates.'].join('\n');
}
