import {windowNotebook} from './windowNotebook';
export function findNotebookCopies(log,entries,text='',row=''){
 const checked=windowNotebook(log,entries).windows;
 if(typeof text!=='string'||text.length>200)throw Error('Use at most 200 characters for literal saved-copy search.');
 if(typeof row!=='string'||(row!==''&&(!/^[1-9][0-9]*$/.test(row)||!Number.isSafeInteger(Number(row))||Number(row)>log.samples.length)))throw Error(`Use a whole original data row from 1 through ${log.samples.length}, or leave it empty.`);
 const query=text.trim().toLowerCase(),originalRow=row===''?null:Number(row);
 return checked.flatMap((entry,index)=>(!query||[entry.label,entry.notes,entry.id].some(value=>value.toLowerCase().includes(query)))&&(originalRow===null||entry.first_row<=originalRow&&entry.last_row>=originalRow)?[{entry:entries[index],ordinal:index+1}]:[]);
}
