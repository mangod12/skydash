import { LOG_VERSION } from './flightLog';
export const CHECKLIST_VERSION = 'skydash-debrief-checklist-v1';
export const TEMPLATE_VERSION = 'skydash-debrief-checklist-template-v1';
export const CHECKLIST_LIMIT = 30;
export const CHECKLIST_BYTES = 128 * 1024;
export const CHECKLIST_STATES = ['Pending', 'Discussed', 'Not applicable'];
export const CHECKLIST_SCOPE = 'Reviewer-authored discussion checklist, not an operational preflight checklist, approved procedure, assessment, certification or flight clearance. Discussed and Not applicable are unverified reviewer annotations, not proof of competence or completeness.';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || Boolean(value.trim()));
function source(log) {
  if (log?.model_version !== LOG_VERSION || !/^[a-f0-9]{64}$/.test(log.sha256) || !log.samples?.length) throw new Error('Load a supported exact recorded source before using a checklist.');
}
function prompts(items, full = false, log) {
  if (!Array.isArray(items) || items.length > CHECKLIST_LIMIT) throw new Error('At most 30 discussion prompts are supported.');
  const ids = new Set();
  return items.map(item => {
    if (!exact(item, full ? ['id', 'prompt', 'status', 'note', 'row'] : ['id', 'prompt']) || !text(item.id, 80, true) || !/^[a-zA-Z0-9_-]+$/.test(item.id) || ids.has(item.id) || !text(item.prompt, 500, true)) throw new Error('Invalid prompt fields/text or duplicate identity.');
    ids.add(item.id);
    if (full && (!CHECKLIST_STATES.includes(item.status) || !text(item.note, 1000) || !(item.row === null || Number.isInteger(item.row) && item.row >= 1 && item.row <= log.samples.length))) throw new Error('Invalid checklist status, note or original row reference.');
    if (full && item.status === 'Not applicable' && !item.note.trim()) throw new Error('Not applicable requires a reviewer reason.');
    return { ...item };
  });
}
const bounded = data => { if (new Blob([JSON.stringify(data, null, 2)]).size > CHECKLIST_BYTES) throw new Error('Checklist JSON must be at most 128KiB.'); return data; };
export function checklistReview(log, title, items) {
  source(log);
  if (!text(title, 120, true)) throw new Error('Checklist title is required, at most 120 characters.');
  return bounded({ format: CHECKLIST_VERSION, replay_model: LOG_VERSION, source_sha256: log.sha256, title, items: prompts(items, true, log) });
}
export function checklistTemplate(log, title, items) {
  const checked = checklistReview(log, title, items);
  return bounded({ format: TEMPLATE_VERSION, title: checked.title, items: checked.items.map(({ id, prompt }) => ({ id, prompt })) });
}
export function readChecklist(value, log) {
  source(log);
  if (typeof value !== 'string' || new Blob([value]).size > CHECKLIST_BYTES) throw new Error('Checklist JSON must be at most 128KiB.');
  let data; try { data = JSON.parse(value); } catch { throw new Error('Checklist is not valid JSON.'); }
  if (data?.format === TEMPLATE_VERSION) {
    if (!exact(data, ['format', 'title', 'items']) || !text(data.title, 120, true)) throw new Error('Unsupported template fields or title.');
    return { kind: 'template', review: checklistReview(log, data.title, prompts(data.items).map(item => ({ ...item, status: 'Pending', note: '', row: null }))) };
  }
  if (!exact(data, ['format', 'replay_model', 'source_sha256', 'title', 'items']) || data.format !== CHECKLIST_VERSION || data.replay_model !== LOG_VERSION) throw new Error('Unsupported checklist fields or models.');
  if (data.source_sha256 !== log.sha256) throw new Error('Checklist source fingerprint mismatch. Load the exact CSV.');
  return { kind: 'review', review: checklistReview(log, data.title, data.items) };
}
export function checklistReport(log, title, items) {
  const data = checklistReview(log, title, items), show = (value, unit) => value === null ? 'unknown' : `${value}${unit}`;
  return ['SKYDASH / DISCUSSION CHECKLIST', CHECKLIST_VERSION, CHECKLIST_SCOPE, `Title: ${data.title}`, `Source: ${log.filename}; SHA-256 ${log.sha256}; replay model ${LOG_VERSION}`, `${data.items.length} prompts in reviewer order; ${CHECKLIST_STATES.map(state => `${state}: ${data.items.filter(item => item.status === state).length}`).join('; ')}. Counts do not establish review completeness.`, '', ...data.items.flatMap((item, index) => {
    const sample = item.row === null ? null : log.samples[item.row - 1];
    const gap = sample && item.row > 1 ? sample.time_s - log.samples[item.row - 2].time_s : null;
    return [`${index + 1}. ${item.prompt}`, `Reviewer annotation: ${item.status}; note/reason: ${item.note || '(none)'}`, sample ? `Original row ${item.row} at ${sample.time_s}s; previous spacing ${gap === null ? 'none, first row' : `${gap}s${gap > 5 ? ' / gap over 5s' : ''}`}. Source altitude ${show(sample.altitude_m, 'm')}; ground speed ${show(sample.ground_speed_m_s, 'm/s')}; battery ${show(sample.battery_pct, '%')}.` : 'No original source row referenced. No source evidence asserted.', ''];
  }), 'Original-row evidence recomputed from loaded source, not imported metrics. References are discussion context, not causation. Source altitude datum unverified; ground speed not airspeed; percentage not energy. No interpolation or claims about unobserved gaps. Report omits coordinates but includes source identity/times/private prompts/notes. Review JSON reopens only with exact CSV. Template JSON carries title/prompts only, never status/notes/references or source identity. Both are unverified editable files, not signed or tamper-evident. Session-only, download separately from cases/comparison/notebooks/library. No backend writes, automatic storage/upload/sharing/notifications or aircraft commands.'].join('\n');
}
