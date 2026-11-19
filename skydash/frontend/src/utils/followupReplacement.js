import { readFollowupPacket } from './debriefFollowup';
export const ACTION_DIFF_FIELDS = ['row', 'text', 'owner', 'target', 'status', 'closure'];
export const CHECKLIST_DIFF_FIELDS = ['prompt', 'status', 'note', 'row'];
export const FOLLOWUP_DIFF_SCOPE = 'PRIVATE REPLACEMENT COMPARISON. Before is the current saved two-section follow-up at the last explicit comparison; after is the imported packet preview. Exact IDs are compared within each section only, never matched by similar text. New IDs are additions/removals even if text is identical. Positions are 1-based reviewer list positions, not priorities or evidence of intentional reordering. Imported authorship, labels, status and outcomes remain unverified. Not a merge, audit history, assignment, approved procedure, grade or verified completion.';
function sectionDiff(before, after, fields) {
  const old = new Map(before.map((item, index) => [item.id, { item, position: index + 1 }]));
  const incoming = new Map(after.map((item, index) => [item.id, { item, position: index + 1 }]));
  const ids = [...before.map(item => item.id), ...after.filter(item => !old.has(item.id)).map(item => item.id)];
  return ids.map(id => {
    const a = old.get(id), b = incoming.get(id), changedFields = a && b ? fields.filter(key => a.item[key] !== b.item[key]) : [];
    return { id, kind: !a ? 'added' : !b ? 'removed' : changedFields.length ? 'changed' : 'unchanged', changedFields, beforePosition: a?.position ?? null, afterPosition: b?.position ?? null, positionChanged: Boolean(a && b && a.position !== b.position), before: a?.item ?? null, after: b?.item ?? null };
  });
}
export function followupReplacementDiff(log, current, imported) {
  const before = readFollowupPacket(JSON.stringify(current), log), after = readFollowupPacket(JSON.stringify(imported), log);
  const actions = sectionDiff(before.actions.items, after.actions.items, ACTION_DIFF_FIELDS), checklist = sectionDiff(before.checklist.items, after.checklist.items, CHECKLIST_DIFF_FIELDS);
  const counts = rows => ({ added: rows.filter(row => row.kind === 'added').length, removed: rows.filter(row => row.kind === 'removed').length, changed: rows.filter(row => row.kind === 'changed').length, unchanged: rows.filter(row => row.kind === 'unchanged').length, positionChanged: rows.filter(row => row.positionChanged).length });
  return { before, after, actions, checklist, actionCounts: counts(actions), checklistCounts: counts(checklist), titleChanged: before.checklist.title !== after.checklist.title };
}
export function followupDiffReport(log, current, imported) {
  const diff = followupReplacementDiff(log, current, imported);
  const render = (name, rows, counts, fields) => [name, Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join('; '), ...rows.flatMap(row => [`ID ${row.id}: ${row.kind}; before position ${row.beforePosition ?? 'none'}, after position ${row.afterPosition ?? 'none'}; position changed: ${row.positionChanged ? 'yes' : 'no'}`, `Changed fields: ${row.changedFields.join(', ') || 'none'}`, ...['before', 'after'].flatMap(side => row[side] ? [`${side.toUpperCase()}:`, ...fields.map(key => `${key}: ${row[side][key] === null ? '(no row reference)' : row[side][key]}`)] : [`${side.toUpperCase()}: (item absent)`]), ''])];
  return ['SKYDASH / FOLLOW-UP REPLACEMENT COMPARISON', FOLLOWUP_DIFF_SCOPE, `Exact source SHA-256: ${log.sha256}`, 'All items, including unchanged, in before reviewer order followed by new incoming IDs. Before/after positions preserve each actual list. No CSV or computed source evidence, no coordinates except those a reviewer may have typed in private annotations.', `Checklist title changed: ${diff.titleChanged ? 'yes' : 'no'}`, `BEFORE title: ${diff.before.checklist.title}`, `AFTER title: ${diff.after.checklist.title}`, '', ...render('ACTION REGISTER', diff.actions, diff.actionCounts, ACTION_DIFF_FIELDS), ...render('DISCUSSION CHECKLIST', diff.checklist, diff.checklistCounts, CHECKLIST_DIFF_FIELDS), 'Comparison does not apply changes. Replace still overwrites both sections atomically, never selectively merges. This report cannot reopen a review. Keep exact CSV and packet JSON separately. Editable, not signed or tamper-evident. No storage, uploads, messages, reminders, backend writes or aircraft commands.'].join('\n');
}
