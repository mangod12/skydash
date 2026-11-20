import {windowNotebook} from './windowNotebook';
import {reviewWindow} from './reviewWindow';
export function notebookBoundsPreview(log,entries,id,first,last){
 const checked=windowNotebook(log,entries).windows,index=checked.findIndex(entry=>entry.id===id);
 if(index<0)throw Error('Choose an existing saved copy. Notebook unchanged.');
 const entry=checked[index];
 if(!Number.isInteger(first)||!Number.isInteger(last))throw Error('Choose whole inclusive original data rows. Notebook unchanged.');
 const proposed={...entry,first_row:first,last_row:last};
 windowNotebook(log,checked.map((value,i)=>i===index?proposed:value));
 if(first===entry.first_row&&last===entry.last_row)throw Error('Proposed bounds already match the saved copy. Notebook unchanged.');
 const facts=value=>{const result=reviewWindow(log,value.first_row-1,value.last_row-1,value.label,value.notes),s=result.summary;return{first_row:value.first_row,last_row:value.last_row,start_s:result.startS,end_s:result.endS,count:s.count,altitude_known:s.altitudeCount,speed_known:s.speedCount,battery_known:s.batteryCount,gaps:s.gapCount};};
 return{source_sha256:log.sha256,ordinal:index+1,original:entry,proposed,before:facts(entry),after:facts(proposed)};
}
export function applyNotebookBounds(log,entries,id,first,last,preview){
 const checked=notebookBoundsPreview(log,entries,id,first,last);
 if(JSON.stringify(checked)!==JSON.stringify(preview))throw Error('Saved copy or bounds choices changed. Preview bounds again.');
 return windowNotebook(log,entries.map(entry=>entry.id===id?checked.proposed:entry)).windows;
}
