import { MAX_NOTEBOOK_WINDOWS, readWindowNotebook, validateWindowEntries, windowNotebook } from './windowNotebook';
export const NOTEBOOK_IMPORT_SCOPE='SAVED-COPY IMPORT COMPARISON, NOT REVIEWER IDENTITY OR A FLIGHT RESULT. Match only exact saved-copy IDs within this exact-source notebook. IDs are editable and do not prove authorship, ancestry or equivalent meaning. Different IDs remain separate even with identical bounds/notes; overlaps are not deduplicated. No discussion completion, grades or readiness claims.';
export function compareNotebookImport(log,entries,incoming){
 const before=validateWindowEntries(log,entries),after=readWindowNotebook(JSON.stringify(incoming),log).windows;
 const old=new Map(before.map((entry,index)=>[entry.id,{entry,index}])),next=new Map(after.map((entry,index)=>[entry.id,{entry,index}]));
 const items=after.map((entry,index)=>{const previous=old.get(entry.id);const fields=previous?['first_row','last_row','label','notes'].filter(key=>previous.entry[key]!==entry[key]):[];return{id:entry.id,before:previous?.entry||null,after:entry,beforeIndex:previous?.index??null,afterIndex:index,fields,status:!previous?'new ID':fields.length?'changed':'unchanged',moved:Boolean(previous&&previous.index!==index)};});
 for(const[ id,previous]of old)if(!next.has(id))items.push({id,before:previous.entry,after:null,beforeIndex:previous.index,afterIndex:null,fields:[],status:'removed ID',moved:false});
 return {items,newCount:items.filter(x=>x.status==='new ID').length,removedCount:items.filter(x=>x.status==='removed ID').length,changedCount:items.filter(x=>x.status==='changed').length,unchangedCount:items.filter(x=>x.status==='unchanged').length,movedCount:items.filter(x=>x.moved).length,currentCount:before.length,incomingCount:after.length};
}
export function appendNotebookImport(log,entries,incoming,newId=()=>globalThis.crypto.randomUUID()){
 const before=validateWindowEntries(log,entries),after=readWindowNotebook(JSON.stringify(incoming),log).windows;
 if(!after.length)throw new Error('An empty import cannot append saved copies. Replace explicitly to clear, or keep the current notebook.');
 if(before.length+after.length>MAX_NOTEBOOK_WINDOWS)throw new Error('Appending exceeds 20 saved copies. Remove backed-up copies or replace explicitly. Nothing appended.');
 const appended=after.map(entry=>({...entry,id:newId()}));
 return windowNotebook(log,[...before,...appended]);
}
