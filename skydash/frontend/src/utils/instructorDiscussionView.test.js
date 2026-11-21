import { describe, expect, it } from 'vitest';
import { instructorDiscussionView as view } from './instructorDiscussionView';
const markers = [
  {id:'a',time_s:2,kind:'Question',discussed:false,text:'<script>literal</script>'},
  {id:'b',time_s:2,kind:'Follow-up',discussed:false,text:'same time, separate note'},
  {id:'c',time_s:3,kind:'Observation',discussed:false,text:'not a queue task'},
  {id:'d',time_s:4,kind:'Question',discussed:true,text:'retained outside queue'},
];
describe('instructor discussion presentation',()=>{
 it('filters only explicit undiscussed kinds without deduplication, mutation or inferred tasks',()=>{
  const before=JSON.stringify(markers); const selected=view(markers,'open');
  expect(selected).toMatchObject({questions:1,followups:1,total:2,page:0,pages:1});
  expect(selected.items).toEqual(markers.slice(0,2));expect(selected.items[0]).toBe(markers[0]);
  expect(view(markers,'questions').items).toEqual([markers[0]]);expect(view(markers,'followups').items).toEqual([markers[1]]);
  expect(view(markers,'all').items).toEqual(markers);expect(JSON.stringify(markers)).toBe(before);
 });
 it('bounds every page, preserves original timeline order and keeps complete count independent of page',()=>{
  const list=Array.from({length:100},(_,i)=>({...markers[0],id:String(i),time_s:i}));
  expect(view(list,'open',5)).toMatchObject({total:100,pages:10,page:5,questions:100});
  expect(view(list,'open',5).items.map(v=>v.id)).toEqual(Array.from({length:10},(_,i)=>String(i+50)));
  expect(view(list,'all',99).page).toBe(9);for(const p of [-1,NaN,Infinity,1.5])expect(view(list,'all',p).page).toBe(0);
  expect(view(list.slice(0,10),'open',9).page).toBe(0);expect(view([],'open',9)).toMatchObject({items:[],total:0,pages:1,page:0});
 });
 it('empty queue is not an empty timeline and unknown filters cannot hide annotations',()=>{
  expect(view(markers.slice(2),'open').items).toEqual([]);expect(view(markers,'__proto__').items).toEqual(markers);
 });
 it('combines literal trimmed case-insensitive saved-note search with kind views without changing global discussion counts',()=>{
  expect(view(markers,'all',0,'  SAME TIME  ').items).toEqual([markers[1]]);expect(view(markers,'questions',0,'same time').items).toEqual([]);expect(view(markers,'all',0,'<SCRIPT>').items).toEqual([markers[0]]);expect(view(markers,'all',0,'.*').items).toEqual([]);expect(view(markers,'all',0,'retained')).toMatchObject({questions:1,followups:1,items:[markers[3]]});expect(view(markers,'all',0,'  ').items).toEqual(markers);expect(view(markers,'open',0,'retained').items).toEqual([]);
 });
 it('pages every matching original note including identical-time notes and clamps after search',()=>{
  const list=Array.from({length:100},(_,i)=>({...markers[0],id:String(i),text:i%2?'needle':'other'}));const selected=view(list,'all',3,'NEEDLE');expect(selected).toMatchObject({total:50,pages:5,page:3});expect(selected.items[0]).toBe(list[61]);expect(view(list,'all',9,'needle').page).toBe(4);expect(view(list,'all',9,'no matches')).toMatchObject({total:0,page:0,pages:1,items:[]});
 });

});
