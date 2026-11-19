import { readFollowupPacket } from './debriefFollowup';
export const FOLLOWUP_INDEX_SCOPE = 'SAVED FOLLOW-UP REFERENCE INDEX. Groups reviewer-authored action and discussion-checklist row references by exact original CSV data row. A reference is discussion context, not sensor evidence of an action, causal relationship, accepted assignment or verified completion. Counts are references and distinct referenced rows, not review coverage, competence or completeness. Unreferenced prompts make no source claim. Status, owner/target labels and private notes remain unverified. No notifications, grades, certification or flight clearance.';
export const FOLLOWUP_INDEX_FILTERS = ['all', 'actions', 'checklist'];
export function followupReferenceIndex(log, packet) {
  const checked = readFollowupPacket(JSON.stringify(packet), log), groups = new Map(), unreferenced = [];
  const group = row => {
    if (!groups.has(row)) {
      const sample = log.samples[row - 1], spacing = row > 1 ? sample.time_s - log.samples[row - 2].time_s : null;
      groups.set(row, { row, time: sample.time_s, spacing, gapBefore: spacing !== null && spacing > 5, altitude: sample.altitude_m, speed: sample.ground_speed_m_s, battery: sample.battery_pct, actions: [], checklist: [] });
    }
    return groups.get(row);
  };
  checked.actions.items.forEach((item, index) => group(item.row).actions.push({ position: index + 1, item }));
  checked.checklist.items.forEach((item, index) => { const reference = { position: index + 1, item }; if (item.row === null) unreferenced.push(reference); else group(item.row).checklist.push(reference); });
  return { packet: checked, rows: [...groups.values()].sort((a, b) => a.row - b.row), unreferenced, actionCount: checked.actions.items.length, referencedPromptCount: checked.checklist.items.length - unreferenced.length, unreferencedPromptCount: unreferenced.length };
}
export function followupIndexRows(index, filter = 'all') {
  if (!FOLLOWUP_INDEX_FILTERS.includes(filter)) throw new Error('Unsupported follow-up reference filter.');
  return index.rows.filter(row => filter === 'all' || row[filter].length > 0);
}
export function followupReferenceReport(log, packet, filter = 'all') {
  const index = followupReferenceIndex(log, packet), rows = followupIndexRows(index, filter), unreferenced = filter === 'actions' ? [] : index.unreferenced;
  const annotations = (name, values, fields) => values.flatMap(({ position, item }) => [`${name} position ${position}; ID ${item.id}`, ...fields.map(key => `${key}: ${item[key] === null ? '(no original row)' : item[key] || '(empty text)'}`)]);
  const actions = values => annotations('Action', values, ['row', 'text', 'owner', 'target', 'status', 'closure']), checklist = values => annotations('Checklist prompt', values, ['row', 'prompt', 'status', 'note']);
  const show = (value, unit) => value === null ? 'unknown' : String(value) + unit;
  return ['SKYDASH / SAVED FOLLOW-UP REFERENCE INDEX', FOLLOWUP_INDEX_SCOPE, `Exact source SHA-256: ${log.sha256}`, `Checklist title: ${index.packet.checklist.title}`, `Filter: ${filter}. All ${rows.length}/${index.rows.length} matching referenced rows, not only visible page. Matching row includes both kinds of annotation, even when only one kind selected.`, `Global snapshot: ${index.actionCount} action references; ${index.referencedPromptCount} checklist row references; ${index.unreferencedPromptCount} prompts without a row. Distinct referenced original rows: ${index.rows.length}. Not coverage.`, '', ...rows.flatMap(row => [`Original data row ${row.row} at ${row.time}s; previous spacing ${row.spacing === null ? 'none, first row' : `${row.spacing}s${row.gapBefore ? ' / gap over 5s' : ''}`}. No unsampled interval observations inferred.`, `Source altitude ${show(row.altitude, 'm')}; ground speed ${show(row.speed, 'm/s')}; battery ${show(row.battery, '%')}. Units apply only to known values, altitude datum unverified, ground speed not airspeed, percentage not energy.`, ...actions(row.actions), ...checklist(row.checklist), '']), 'PROMPTS WITHOUT AN ORIGINAL ROW REFERENCE', ...checklist(unreferenced), ...(!unreferenced.length ? ['None in this filter, not a completeness claim.'] : []), '', 'Original-row evidence recomputed from loaded CSV. No joining, interpolation or gap crossing inferred. Referenced rows sorted in original source order; annotations retain positions in each reviewer list. Report includes fingerprints/times/channel readings/private labels/notes, no CSV or coordinate fields, but annotations can mention private places/people. Not authenticated, signed, tamper-evident or a reopenable packet. Keep exact CSV and packet JSON separately. Session-only derived view, no automatic save/upload/sharing/backend writes or aircraft commands.'].join('\n');
}
