import { LOG_VERSION, LOG_SCOPE } from './flightLog';
import { recordedObservation } from './flightComparison';
export const DEBRIEF_VERSION = 'skydash-instructor-debrief-v1';
export const MAX_MARKERS = 100;
export const MAX_DEBRIEF_BYTES = 256 * 1024;
export const MARKER_KINDS = ['Observation', 'Question', 'Follow-up'];
export const DEBRIEF_SCOPE = 'INSTRUCTOR-AUTHORED REVIEW. Markers, labels and discussion notes are human annotations, not detected flight events, verified facts or training grades. Marker time is elapsed CSV time, not UTC. A gap marker refers to a held sample, not an observation at the marker time. Nothing is sent to an aircraft or saved to the server archive. Download the debrief sidecar and source CSV before leaving this screen.';
function validText(value, max, required = false) {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}
export function validateMarkers(markers, duration) {
  if (!Array.isArray(markers) || markers.length > MAX_MARKERS) throw new Error('At most 100 review markers are supported.');
  const ids = new Set();
  for (const marker of markers) {
    if (!marker || typeof marker !== 'object' || Array.isArray(marker) || Object.keys(marker).some(key => !['id', 'time_s', 'kind', 'text', 'discussed'].includes(key))) throw new Error('Invalid review marker fields.');
    if (!validText(marker.id, 80, true) || ids.has(marker.id)) throw new Error('Marker IDs must be present and unique.');
    ids.add(marker.id);
    if (!Number.isFinite(marker.time_s) || marker.time_s < 0 || marker.time_s > duration) throw new Error('Marker time is outside this recorded source.');
    if (!MARKER_KINDS.includes(marker.kind) || !validText(marker.text, 1000, true) || typeof marker.discussed !== 'boolean') throw new Error('Invalid marker type, note or discussion state.');
  }
  return [...markers].sort((a, b) => a.time_s - b.time_s || a.id.localeCompare(b.id));
}
export function createReviewMarker(log, { id, time_s, kind, text }) {
  return validateMarkers([{ id, time_s, kind, text: text.trim(), discussed: false }], log.samples.at(-1).time_s)[0];
}
export function debriefSidecar(log, markers, notes = '') {
  if (!validText(notes, 4000)) throw new Error('Discussion summary is limited to 4,000 characters.');
  const data = { format: DEBRIEF_VERSION, replay_model: LOG_VERSION, source_sha256: log.sha256,
    markers: validateMarkers(markers, log.samples.at(-1).time_s), notes };
  if (new Blob([JSON.stringify(data, null, 2)]).size > MAX_DEBRIEF_BYTES) throw new Error('Review exceeds 256KiB. Shorten notes or remove markers before exporting.');
  return data;
}
export function readDebriefSidecar(text, log) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_DEBRIEF_BYTES) throw new Error('Debrief JSON must be at most 256KiB.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Debrief file is not valid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['format', 'replay_model', 'source_sha256', 'markers', 'notes'].includes(key))) throw new Error('Invalid debrief sidecar fields.');
  if (data.format !== DEBRIEF_VERSION || data.replay_model !== LOG_VERSION || log.model_version !== LOG_VERSION) throw new Error('Debrief or replay model version is unsupported.');
  if (data.source_sha256 !== log.sha256) throw new Error('Source fingerprint mismatch. Load the exact matching CSV first.');
  if (!validText(data.notes, 4000)) throw new Error('Discussion summary is missing or too long.');
  return debriefSidecar(log, data.markers, data.notes);
}
export function instructorReport(log, markers, notes = '') {
  const data = debriefSidecar(log, markers, notes);
  const show = (value, unit) => value === null ? 'unknown' : `${value.toFixed(2)}${unit}`;
  return ['SKYDASH / INSTRUCTOR DEBRIEF TIMELINE', DEBRIEF_SCOPE, LOG_SCOPE, '', `Debrief model: ${DEBRIEF_VERSION}`, `Replay model: ${LOG_VERSION}`, `Source: ${log.filename}`, `Source SHA-256: ${log.sha256}`, `Review markers: ${data.markers.length}`, `Marked discussed: ${data.markers.filter(marker => marker.discussed).length}. Discussion state is a review checkbox, not a competence assessment.`, '',
    ...data.markers.flatMap((marker, index) => {
      const evidence = recordedObservation(log.samples, marker.time_s), sample = evidence.sample;
      return [`${index + 1}. ${marker.time_s.toFixed(3)}s / ${marker.kind} / ${marker.discussed ? 'Discussed' : 'Open for discussion'}`, `Instructor note: ${marker.text}`, `Source context: sample ${evidence.index + 1} at ${sample.time_s}s, age ${evidence.ageS.toFixed(3)}s${evidence.state === 'gap' ? ' / DATA GAP, held sample, no observation at marker time' : ' / latest recorded observation at or before marker time'}`, `Latitude ${sample.latitude}, longitude ${sample.longitude}; source altitude ${show(sample.altitude_m, 'm')}; speed ${show(sample.ground_speed_m_s, 'm/s')}; battery ${show(sample.battery_pct, '%')}`, ''];
    }), 'DISCUSSION SUMMARY (instructor-authored)', notes || '(none)', '', 'Reproduce by loading the exact source CSV and importing the debrief JSON sidecar with the listed model versions. Recomputed sample context comes from the source, not the annotation file. A matching fingerprint does not authenticate the instructor, source or notes. Sidecars and reports are editable files, not tamper-evident records. Downloaded report includes coordinates and private review notes. No automatic sharing or server storage.'].join('\n');
}
