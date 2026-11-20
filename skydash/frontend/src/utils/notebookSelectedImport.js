import {readWindowNotebook,windowNotebook} from './windowNotebook';
export function selectedNotebookImport(log,incoming,ids){
 const checked=readWindowNotebook(JSON.stringify(incoming),log);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!checked.windows.some(entry=>entry.id===id)))throw new Error('Choose one or more distinct existing imported copies. Nothing appended.');
 return windowNotebook(log,checked.windows.filter(entry=>ids.includes(entry.id)));
}
