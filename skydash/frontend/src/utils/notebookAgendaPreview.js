import {windowNotebook} from './windowNotebook';
export function notebookAgendaPreview(log,entries,ids){
 const checked=windowNotebook(log,entries).windows;
 if(checked.length<2||!Array.isArray(ids)||ids.length!==checked.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!checked.some(entry=>entry.id===id)))throw Error('Choose every existing saved copy exactly once. At least two copies are required. Notebook unchanged.');
 const rows=ids.map((id,index)=>{const ordinal=checked.findIndex(entry=>entry.id===id)+1;return{entry:checked[ordinal-1],ordinal,newOrdinal:index+1};});
 if(rows.every(row=>row.ordinal===row.newOrdinal))throw Error('The proposed agenda already matches the saved order. Notebook unchanged.');
 return {source_sha256:log.sha256,rows};
}
export function applyNotebookAgenda(log,entries,ids,preview){
 const checked=notebookAgendaPreview(log,entries,ids);
 if(JSON.stringify(checked)!==JSON.stringify(preview))throw Error('Notebook or agenda choices changed. Preview the complete agenda again.');
 return windowNotebook(log,checked.rows.map(row=>row.entry)).windows;
}
