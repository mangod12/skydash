import {validateWindowEntries,windowNotebook} from './windowNotebook';
export function scopedNotebookHandoff(log,entries,ids,{includeLabels=false,includeNotes=false}={}){
 const checked=validateWindowEntries(log,entries);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!checked.some(entry=>entry.id===id)))throw new Error('Choose at least one distinct existing saved copy.');
 if(typeof includeLabels!=='boolean'||typeof includeNotes!=='boolean')throw new Error('Annotation choices must be explicit booleans.');
 const selected=checked.flatMap((entry,index)=>ids.includes(entry.id)?[{...entry,label:includeLabels?entry.label:`Saved selection ${index+1}`,notes:includeNotes?entry.notes:''}]:[]);
 return windowNotebook(log,selected);
}
