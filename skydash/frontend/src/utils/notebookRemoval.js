import {validateWindowEntries} from './windowNotebook';
export function notebookRemoval(log,entries,ids){
 const checked=validateWindowEntries(log,entries);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!checked.some(entry=>entry.id===id)))throw Error('Choose distinct existing saved copies to remove. Notebook unchanged.');
 const rows=checked.map((entry,index)=>({entry,ordinal:index+1}));
 return {removed:rows.filter(row=>ids.includes(row.entry.id)),kept:rows.filter(row=>!ids.includes(row.entry.id))};
}
