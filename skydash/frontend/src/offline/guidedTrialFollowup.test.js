import {describe,expect,it} from 'vitest';
import {createTrialFollowup,parseTrialFollowup,serializeTrialFollowup,trialFollowupTasks as tasks,trialNoteLimit,trialFollowupByteLimit,validateTrialFollowup} from './guidedTrialFollowup';
const encode=text=>new TextEncoder().encode(text),notes=()=>Object.fromEntries(tasks.map(task=>[task,'']));
const sample=()=>createTrialFollowup([tasks[2],tasks[0]],{...notes(),[tasks[0]]:'PRIVATE <img src=x onerror=alert(1)>\nExact second line.',['discussionCompare']:'A question, not completion.'});
it('round trips only five ordered manual flags and exact notes, no source or tool-use fields and no mutation',()=>{
 const flags=[tasks[2],tasks[0]],input={...notes(),[tasks[0]]:'\t Exact PRIVATE words\n<b>not HTML</b> '},before=structuredClone(input),text=serializeTrialFollowup(flags,input),value=parseTrialFollowup(encode(text));
 expect(Object.keys(value)).toEqual(['format','version','steps']);expect(value.steps.map(step=>step.task)).toEqual(tasks);expect(value.steps.map(step=>step.flagged)).toEqual([true,false,true,false,false]);expect(value.steps[0].note).toBe(input[tasks[0]]);expect(input).toEqual(before);expect(flags).toEqual([tasks[2],tasks[0]]);expect(Object.keys(value.steps[0])).toEqual(['task','flagged','note']);expect(text.endsWith('\n')).toBe(true);
});
it('empty flags/notes is a valid blank personal worksheet, not inferred completion',()=>{const value=createTrialFollowup([],notes());expect(value.steps).toHaveLength(5);expect(value.steps.every(step=>step.flagged===false&&step.note==='')).toBe(true);});
it('all maximum-length notes, including escaped controls, remain within the explicit complete-file bound',()=>{for(const char of['界','\u0000','"','\\']){const input=Object.fromEntries(tasks.map(task=>[task,char.repeat(trialNoteLimit)])),text=serializeTrialFollowup([...tasks],input);expect(encode(text).length).toBeLessThanOrEqual(trialFollowupByteLimit);expect(parseTrialFollowup(encode(text))).toEqual(createTrialFollowup([...tasks],input));}});
describe('strict supported personal-follow-up shape',()=>{
 const mutations=[
  value=>({...value,source:'never accepted'}),value=>({...value,version:2}),value=>({...value,version:'1'}),value=>({...value,format:'another format'}),
  value=>({...value,steps:value.steps.slice(1)}),value=>({...value,steps:[...value.steps,value.steps[0]]}),value=>({...value,steps:[...value.steps].reverse()}),
  value=>({...value,steps:value.steps.map((step,i)=>i===1?{...step,task:value.steps[0].task}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{...step,task:'__proto__'}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{...step,flagged:'true'}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{...step,flagged:1}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{...step,note:null}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{...step,note:'x'.repeat(trialNoteLimit+1)}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{...step,completed:true}:step)}),
  value=>({...value,steps:value.steps.map((step,i)=>i===0?{task:step.task,flagged:false}:step)})
 ];
 it.each(mutations.map((mutate,index)=>[index,mutate]))('refuses unsupported shape %s without accepting partial personal data',(_,mutate)=>{const value=sample(),before=structuredClone(value),invalid=mutate(value);expect(()=>validateTrialFollowup(invalid)).toThrow('refused');expect(()=>parseTrialFollowup(encode(JSON.stringify(invalid)))).toThrow('refused');expect(value).toEqual(before);});
 it.each([null,undefined,[],true,1,'text'])('refuses non-object root %s',value=>expect(()=>validateTrialFollowup(value)).toThrow('refused'));
});
it('refuses malformed JSON, BOM, invalid UTF-8, empty/oversize bytes and non-byte input',()=>{for(const bytes of[encode('{'),encode('\ufeff'+JSON.stringify(sample())),new Uint8Array([0xff,0xfe]),new Uint8Array(),new Uint8Array(trialFollowupByteLimit+1),JSON.stringify(sample()),null])expect(()=>parseTrialFollowup(bytes)).toThrow('refused');});
it('serialization never silently drops unknown/duplicate flags or missing/extra note keys',()=>{const missing=notes();delete missing[tasks[0]];for(const[flags,input]of[[['unknown'],notes()],[[tasks[0],tasks[0]],notes()],[null,notes()],[[],missing],[[],{...notes(),extra:'secret'}],[[],{...notes(),[tasks[0]]:false}]])expect(()=>serializeTrialFollowup(flags,input)).toThrow('refused');});
it('returns new normalized rows rather than mutable aliases to parsed input',()=>{const value=sample(),copy=validateTrialFollowup(value);expect(copy).toEqual(value);copy.steps[0].note='changed';expect(value.steps[0].note).not.toBe('changed');});
