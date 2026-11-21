import { debriefSidecar, readDebriefSidecar } from './instructorDebrief';
export const INSTRUCTOR_REPLACEMENT_FIELDS = ['time_s', 'kind', 'text', 'discussed'];
export const INSTRUCTOR_REPLACEMENT_SCOPE = 'PRIVATE INSTRUCTOR REPLACEMENT PREVIEW. Before is the current saved timeline and summary; after is the checked sidecar. Exact annotation IDs only, not matching by time or similar words. New IDs are additions/removals even for identical notes. IDs, authorship, discussion state and notes remain unverified. This is not a merge, audit trail, verified completion, priority or training assessment. Source and other reviews are excluded and unchanged.';
export function instructorReplacement(log, markers, notes, imported) {
  const before = debriefSidecar(log, markers, notes), after = readDebriefSidecar(JSON.stringify(imported), log);
  const old = new Map(before.markers.map((item,index)=>[item.id,{item,position:index+1}]));
  const incoming = new Map(after.markers.map((item,index)=>[item.id,{item,position:index+1}]));
  const ids = [...old.keys(), ...[...incoming.keys()].filter(id=>!old.has(id))];
  const rows = ids.map(id=>{
    const a=old.get(id),b=incoming.get(id),fields=a&&b?INSTRUCTOR_REPLACEMENT_FIELDS.filter(key=>a.item[key]!==b.item[key]):[];
    return { id, kind:!a?'added':!b?'removed':fields.length?'changed':'unchanged', fields, before:a?.item??null,after:b?.item??null,beforePosition:a?.position??null,afterPosition:b?.position??null };
  });
  const counts=Object.fromEntries(['added','removed','changed','unchanged'].map(kind=>[kind,rows.filter(row=>row.kind===kind).length]));
  return { before, after, rows, counts, summaryChanged:before.notes!==after.notes };
}
export function instructorReplacementReport(log, markers, notes, imported) {
  const value=instructorReplacement(log,markers,notes,imported);
  return ['SKYDASH / INSTRUCTOR SIDECAR REPLACEMENT COMPARISON',INSTRUCTOR_REPLACEMENT_SCOPE,`Exact source SHA-256: ${log.sha256}`,
    'All saved markers, including unchanged. Before original timeline order, then new incoming IDs. Positions refer to the separate sorted timelines, not priority or an intentional reorder. No CSV, coordinates or source readings added, but annotation text can contain them.',
    Object.entries(value.counts).map(([key,count])=>`${key}: ${count}`).join('; '),`Discussion summary changed: ${value.summaryChanged?'yes':'no'}`,
    `BEFORE summary: ${value.before.notes || '(empty)'}`,`AFTER summary: ${value.after.notes || '(empty)'}`,'',
    ...value.rows.flatMap(row=>[`ID ${row.id}: ${row.kind}. Changed fields: ${row.fields.join(', ')||'none'}. Before position ${row.beforePosition??'none'}, after position ${row.afterPosition??'none'}.`,
      ...['before','after'].flatMap(side=>row[side]?[side.toUpperCase()+':',...INSTRUCTOR_REPLACEMENT_FIELDS.map(key=>`${key}: ${row[side][key]}`)]:[side.toUpperCase()+': (absent)']),'']),
    'Snapshot at explicit download, not a live comparison. Unadded marker drafts, playback and other reviews are excluded. Keep source CSV and debrief JSON separately; this text cannot reopen or merge a review. Replace still overwrites the timeline/summary together. Editable, not signed or tamper-evident. No sharing, storage, tasks or aircraft commands.'
  ].join('\n');
}
