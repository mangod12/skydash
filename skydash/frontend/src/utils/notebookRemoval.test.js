import {describe,it,expect} from 'vitest';
import {LOG_VERSION,SAMPLE_LOG,parseFlightCSV} from './flightLog';
import {notebookRemoval} from './notebookRemoval';
const log={model_version:LOG_VERSION,sha256:'a'.repeat(64),samples:parseFlightCSV(SAMPLE_LOG)},a={id:'a',first_row:2,last_row:5,label:'A',notes:'Private A'},b={...a,id:'b',label:'B'},c={...a,id:'c',first_row:4,last_row:4,label:'C'};
describe('selected notebook removal plan',()=>{
 it('uses exact IDs, preserves notebook order not click order, kept IDs/annotations/bounds intact',()=>{const x=notebookRemoval(log,[a,b,c],['c','a']);expect(x.removed).toEqual([{entry:a,ordinal:1},{entry:c,ordinal:3}]);expect(x.kept).toEqual([{entry:b,ordinal:2}]);expect(x.kept[0].entry).not.toBe(b);});
 it('permits all copies removed without requiring retained notebook exportable byte size',()=>{expect(notebookRemoval(log,[a,b],['a','b']).kept).toEqual([]);const heavy=Array.from({length:20},(_,i)=>({...a,id:'x'+i,notes:'\u0001'.repeat(4000)}));expect(notebookRemoval(log,heavy,['x1']).kept).toHaveLength(19);});
 it.each([[],['missing'],['a','a'],[1],null,'a'])('rejects invalid/empty selection %j atomically',ids=>{expect(()=>notebookRemoval(log,[a,b],ids)).toThrow('Choose');});
 it('validates existing source and all notebook entries even when corrupted copy is selected for removal',()=>{expect(()=>notebookRemoval({...log,sha256:'bad'},[a],['a'])).toThrow();expect(()=>notebookRemoval(log,[a,{...b,last_row:90}],['b'])).toThrow();});
 it('does not mutate source or entries and has no original observations/coordinates in the plan',()=>{const entries=[a,b,c],before=JSON.stringify({log,entries}),x=notebookRemoval(log,entries,['b']);expect(JSON.stringify({log,entries})).toBe(before);for(const key of ['latitude','longitude','altitude_m','samples'])expect(JSON.stringify(x)).not.toContain(key);});
});
