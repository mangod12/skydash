import {describe,it,expect} from 'vitest';
import {LOG_VERSION,SAMPLE_LOG,parseFlightCSV} from './flightLog';
import {windowNotebook} from './windowNotebook';
import {selectedNotebookImport} from './notebookSelectedImport';
import {appendNotebookImport} from './notebookImportReview';
const log={model_version:LOG_VERSION,sha256:'a'.repeat(64),samples:parseFlightCSV(SAMPLE_LOG)},a={id:'a',first_row:2,last_row:5,label:'A',notes:'Private A'},b={id:'b',first_row:4,last_row:4,label:'B',notes:'Private B'},c={...a,id:'c',label:'C'};
const incoming=()=>windowNotebook(log,[a,b,c]);
describe('selected imported notebook subset',()=>{
 it('retains source/models and exact chosen copies in original imported order, not click order',()=>{const x=selectedNotebookImport(log,incoming(),['c','a']);expect(x).toEqual(windowNotebook(log,[a,c]));expect(x.windows[0]).not.toBe(a);});
 it.each([[],['missing'],['a','a'],[null],null,'a'])('rejects invalid/empty choice %j without falling back to all',ids=>{expect(()=>selectedNotebookImport(log,incoming(),ids)).toThrow('Choose');});
 it('validates the whole incoming source/schema even if corrupted or unmatched copies are unselected',()=>{for(const patch of [{source_sha256:'b'.repeat(64)},{windows:[a,{...b,last_row:9}]},{format:'future'}])expect(()=>selectedNotebookImport(log,{...incoming(),...patch},['a'])).toThrow();});
 it('appends only chosen copies with fresh IDs and keeps all existing copies without deduplication',()=>{let n=0;const subset=selectedNotebookImport(log,incoming(),['c','a']);expect(appendNotebookImport(log,[a],subset,()=>`fresh-${++n}`).windows).toEqual([a,{...a,id:'fresh-1'},{...c,id:'fresh-2'}]);});
 it('permits a selected subset to fit when appending all would overflow; cap and byte checks still apply',()=>{const before=Array.from({length:19},(_,i)=>({...b,id:'old'+i}));expect(()=>appendNotebookImport(log,before,incoming())).toThrow('20');expect(appendNotebookImport(log,before,selectedNotebookImport(log,incoming(),['b']),()=> 'fresh').windows).toHaveLength(20);const heavy=Array.from({length:10},(_,i)=>({...a,id:'heavy'+i,notes:'\u0001'.repeat(4000)}));expect(()=>appendNotebookImport(log,heavy,selectedNotebookImport(log,windowNotebook(log,heavy),heavy.map(x=>x.id)),(()=>{let n=0;return()=>`fresh-${++n}`;})())).toThrow('384KiB');});
 it('never mutates input and does not copy source observations or coordinates into subset',()=>{const source=incoming(),before=JSON.stringify({log,source});const x=selectedNotebookImport(log,source,['b']);expect(JSON.stringify({log,source})).toBe(before);for(const field of ['latitude','longitude','samples','altitude_m'])expect(JSON.stringify(x)).not.toContain(field);});
});
