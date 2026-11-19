import { LOG_VERSION } from './flightLog';
import { actionRegister, readActionRegister, actionRegisterReport } from './debriefActions';
import { CHECKLIST_VERSION, checklistReview, readChecklist, checklistReport } from './debriefChecklist';
export const FOLLOWUP_VERSION = 'skydash-debrief-followup-packet-v1';
export const FOLLOWUP_BYTES = 512 * 1024;
export const FOLLOWUP_SCOPE = 'PRIVATE REVIEWER FOLLOW-UP PACKET, NOT VERIFIED COMPLETION OR AN APPROVED PROCEDURE. Combines saved action register and discussion checklist annotations for the exact loaded CSV. No source CSV/coordinates, instructor markers, comparison or other review state. Action status, owner labels, target text, checklist discussion status, notes and closure are unverified human assertions. No assignments, notifications, reminders, grades, certification or flight clearance.';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
export function followupPacket(log, actions, checklist) {
  const checkedActions = readActionRegister(JSON.stringify(actions), log);
  if (checklist?.format !== CHECKLIST_VERSION) throw new Error('Packet requires a source-specific checklist review, never a reusable template.');
  const checkedChecklist = readChecklist(JSON.stringify(checklist), log).review;
  const data = { format: FOLLOWUP_VERSION, replay_model: LOG_VERSION, source_sha256: log.sha256, actions: actionRegister(log, checkedActions.items), checklist: checklistReview(log, checkedChecklist.title, checkedChecklist.items) };
  if (new Blob([JSON.stringify(data, null, 2)]).size > FOLLOWUP_BYTES) throw new Error('Follow-up packet must be at most 512KiB. Download reviews separately.');
  return data;
}
export function readFollowupPacket(value, log) {
  if (typeof value !== 'string' || new Blob([value]).size > FOLLOWUP_BYTES) throw new Error('Follow-up packet must be at most 512KiB.');
  let data; try { data = JSON.parse(value); } catch { throw new Error('Follow-up packet is not valid JSON.'); }
  if (!exact(data, ['format', 'replay_model', 'source_sha256', 'actions', 'checklist']) || data.format !== FOLLOWUP_VERSION || data.replay_model !== LOG_VERSION) throw new Error('Unsupported follow-up packet fields or models.');
  if (data.source_sha256 !== log?.sha256) throw new Error('Packet source fingerprint mismatch. Load the exact CSV first.');
  return followupPacket(log, data.actions, data.checklist);
}
export function followupReport(log, actions, checklist) {
  const data = followupPacket(log, actions, checklist);
  return ['SKYDASH / DEBRIEF FOLLOW-UP PACKET', FOLLOWUP_VERSION, FOLLOWUP_SCOPE, `Exact source SHA-256: ${log.sha256}`, 'All saved actions and prompts in their own reviewer order, regardless of filters/pages. Original-row evidence recomputed from loaded source, never accepted as imported report text.', '', actionRegisterReport(log, data.actions.items), '', checklistReport(log, data.checklist.title, data.checklist.items), '', 'EXCLUDED: exact source CSV/coordinates, instructor markers/summary, analyst source notes/title, envelope criteria/results, selected windows/notebooks, reference-circle reviews/presets, channel plots/inventories, comparison sources/anchors/reviews, mapping recipe, playback state and backend identity. Keep those separately if needed. Packet applies only the two saved follow-up sections, never claims to be a full workspace backup. Imported authorship/outcomes unverified; editable, not signed or tamper-evident. Contains private action/owner/target/closure/checklist text and source identity/times. Keep exact CSV and packet JSON to reopen. No automatic persistence/upload/sharing/backend writes or aircraft commands.'].join('\n');
}
