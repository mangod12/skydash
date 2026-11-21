import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { debriefSidecar } from './instructorDebrief';
import { instructorReplacement as compare, instructorReplacementReport as report } from './instructorReplacement';
const log={filename:'private-source.csv',model_version:LOG_VERSION,sha256:'a'.repeat(64),csv_text:SAMPLE_LOG,samples:parseFlightCSV(SAMPLE_LOG)};
const a={id:'a',time_s:2,kind:'Question',text:'Before note',discussed:false};
const b={id:'b',time_s:2,kind:'Follow-up',text:'Separate equal time',discussed:false};
const side=(items,notes='')=>debriefSidecar(log,items,notes);
describe('instructor replacement comparison',()=>{
 it('reports every changed field for exact IDs, not similar times/text, and retains unchanged/equal-time annotations',()=>{
  const current=[a,b,{...a,id:'remove'},{...b,id:'same'}],after=side([{...a,time_s:5,kind:'Observation',text:'After note',discussed:true},b,{...a,id:'new'},{...b,id:'same'}],'new summary');
  const before=JSON.stringify({current,after});const value=compare(log,current,'old summary',after);
  expect(value.counts).toEqual({added:1,removed:1,changed:1,unchanged:2});expect(value.summaryChanged).toBe(true);
  expect(value.rows.find(v=>v.id==='a').fields).toEqual(['time_s','kind','text','discussed']);
  expect(value.rows.find(v=>v.id==='remove')).toMatchObject({kind:'removed',after:null});expect(value.rows.at(-1)).toMatchObject({id:'new',kind:'added',before:null});
  expect(value.before.markers.map(v=>v.id)).toEqual(['a','b','remove','same']);expect(value.after.markers.map(v=>v.id)).toEqual(['b','new','same','a']);
  expect(JSON.stringify({current,after})).toBe(before);
 });
 it('rejects wrong sources, unsupported/extra fields, invalid markers and oversized current summaries before comparing',()=>{
  expect(()=>compare(log,[a],'',{...side([a]),source_sha256:'b'.repeat(64)})).toThrow(/fingerprint/);
  expect(()=>compare(log,[a],'',{...side([a]),unknown:true})).toThrow(/fields/);
  expect(()=>compare(log,[a],'',side([{...a,id:'a'},{...b,id:'a'}]))).toThrow(/unique/);
  expect(()=>compare(log,[{...a,time_s:999}],'',side([]))).toThrow(/outside/);
  expect(()=>compare(log,[a],'x'.repeat(4001),side([]))).toThrow(/4,000/);
 });
 it('compares empty timelines and summary-only replacement independently of discussion state',()=>{
  expect(compare(log,[],'',side([]))).toMatchObject({rows:[],summaryChanged:false,counts:{added:0,removed:0,changed:0,unchanged:0}});
  expect(compare(log,[],'before',side([],'after')).summaryChanged).toBe(true);
  expect(compare(log,[a],'',side([{...a,discussed:true}])).rows[0].fields).toEqual(['discussed']);
 });
 it('supports arbitrary validated IDs as data and does not infer related annotations',()=>{
  const value=compare(log,[{...a,id:'__proto__'}],'',side([{...a,id:'constructor'}]));
  expect(value.counts).toMatchObject({added:1,removed:1,changed:0});expect(value.rows.map(v=>v.id)).toEqual(['__proto__','constructor']);
 });
 it('downloads all100markers, original positions, private text and summaries without source bytes/readings or a reopenable claim',()=>{
  const list=Array.from({length:100},(_,i)=>({...a,id:'id-'+String(i).padStart(3,'0'),time_s:i/10,text:'PRIVATE '+i}));
  const output=report(log,list,'Before summary',side(list.map((v,i)=>i===99?{...v,text:'<img onerror=literal>'}:v),'After summary'));
  expect(output).toContain('unchanged: 99');expect(output).toContain('changed: 1');expect(output).toContain('PRIVATE 0');expect(output).toContain('PRIVATE 98');expect(output).toContain('<img onerror=literal>');expect(output).toContain('Before position 100, after position 100');expect(output).toContain('BEFORE summary: Before summary');expect(output).toContain('AFTER summary: After summary');expect(output).toContain(log.sha256);expect(output).not.toContain(SAMPLE_LOG);expect(output).not.toContain('private-source.csv');
 });
});
