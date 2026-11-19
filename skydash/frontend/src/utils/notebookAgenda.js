import { validateWindowEntries, windowNotebook } from './windowNotebook';
export function moveNotebookCopy(log,entries,id,direction){
 const checked=validateWindowEntries(log,entries),index=checked.findIndex(entry=>entry.id===id);
 if(index<0||![1,-1].includes(direction)||index+direction<0||index+direction>=checked.length)throw new Error('Choose an existing saved copy and an available adjacent notebook position.');
 [checked[index],checked[index+direction]]=[checked[index+direction],checked[index]];
 return checked;
}
export function editNotebookCopy(log,entries,id,label,notes){
 const checked=validateWindowEntries(log,entries);
 if(!checked.some(entry=>entry.id===id))throw new Error('Saved copy is no longer present. Nothing edited.');
 if(typeof label!=='string')throw new Error('Saved copy label must be text.');
 return windowNotebook(log,checked.map(entry=>entry.id===id?{...entry,label:label.trim(),notes}:entry)).windows;
}
