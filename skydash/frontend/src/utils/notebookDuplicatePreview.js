import {windowNotebook,MAX_NOTEBOOK_WINDOWS} from './windowNotebook';
export function notebookDuplicatePreview(log,entries,ids){
 const checked=windowNotebook(log,entries).windows;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!checked.some(entry=>entry.id===id)))throw Error('Choose distinct existing saved copies to duplicate. Notebook unchanged.');
 if(checked.length+ids.length>MAX_NOTEBOOK_WINDOWS)throw Error('Duplication would exceed 20 saved copies. Notebook unchanged.');
 const selected=checked.flatMap((entry,index)=>ids.includes(entry.id)?[{entry,ordinal:index+1,newOrdinal:checked.length+1+checked.slice(0,index).filter(e=>ids.includes(e.id)).length}]:[]);
 const used=new Set(checked.map(entry=>entry.id));let serial=0;
 const placeholders=selected.map(({entry})=>{let id;do{id=String(serial++).padStart(80,'_');}while(used.has(id));used.add(id);return{...entry,id};});
 windowNotebook(log,[...checked,...placeholders]);
 return{source_sha256:log.sha256,original:checked,selected};
}
export function applyNotebookDuplicate(log,entries,ids,preview,idFactory=()=>globalThis.crypto.randomUUID()){
 const checked=notebookDuplicatePreview(log,entries,ids);
 if(JSON.stringify(checked)!==JSON.stringify(preview))throw Error('Notebook or duplicate choices changed. Preview again.');
 const used=new Set(entries.map(entry=>entry.id));
 const copies=checked.selected.map(({entry})=>{const id=idFactory();if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||used.has(id))throw Error('Fresh duplicate identity could not be created. Notebook unchanged.');used.add(id);return{...entry,id};});
 return windowNotebook(log,[...checked.original,...copies]).windows;
}
