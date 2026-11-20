import {reviewWindowReport} from './reviewWindow';
import {validateWindowEntries,windowNotebook} from './windowNotebook';
export function scopedNotebookHandoff(log,entries,ids,{includeLabels=false,includeNotes=false}={}){
 const checked=validateWindowEntries(log,entries);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!checked.some(entry=>entry.id===id)))throw new Error('Choose at least one distinct existing saved copy.');
 if(typeof includeLabels!=='boolean'||typeof includeNotes!=='boolean')throw new Error('Annotation choices must be explicit booleans.');
 const selected=checked.flatMap((entry,index)=>ids.includes(entry.id)?[{...entry,label:includeLabels?entry.label:`Saved selection ${index+1}`,notes:includeNotes?entry.notes:''}]:[]);
 return windowNotebook(log,selected);
}

export function scopedNotebookPacket(log,entries,ids,options={}){
 const data=scopedNotebookHandoff(log,entries,ids,options);
 return ['SKYDASH / SCOPED SAVED-COPY DISCUSSION PACKET',
 'Only the chosen saved copies in applied notebook order. Includes exact selected coordinates/channel readings, original row numbers/times and source fingerprint. Saved labels/private notes follow the explicit handoff choices; generic labels retain original notebook positions. Source filename and internal copy IDs excluded. This is not anonymization. No source CSV, outside-row readings or full-source row map. Overlapping observations repeat independently; never add spans/distances or infer completion, grades or readiness. No automatic sharing. Human-readable only, not reopenable, signed or authenticated. Keep exact source CSV and chosen notebook JSON separately.',
 ...data.windows.flatMap((entry,index)=>[`BEGIN CHOSEN COPY ${index+1}`,reviewWindowReport({...log,filename:'(excluded from scoped packet)'},entry.first_row-1,entry.last_row-1,entry.label,entry.notes),`END CHOSEN COPY ${index+1}`])].join('\n');
}
