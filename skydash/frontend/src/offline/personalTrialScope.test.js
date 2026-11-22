import {expect,it} from 'vitest';
import {parsePersonalTrialOrdinals,preparePersonalTrialReport} from './personalTrialReport';
import {trialFollowupTasks as tasks} from './guidedTrialFollowup';
const notes=()=>Object.fromEntries(tasks.map((task,index)=>[task,'PRIVATE step '+(index+1)]));
it('accepts explicit unique numbers and preserves fixed instruction order rather than typed order or flags',()=>{
 expect(parsePersonalTrialOrdinals(' 5, 1 ')).toEqual([5,1]);
 const result=preparePersonalTrialReport([tasks[1]],notes(),[5,1]);expect(result.ordinals).toEqual([1,5]);expect(result.steps.map(step=>step.task)).toEqual([tasks[0],tasks[4]]);expect(result.steps.every(step=>!step.flagged)).toBe(true);expect(result.html).toContain('Only explicit instruction steps 1, 5 of 5');expect(result.html).toContain('partial personal sheet');expect(result.html).toContain('1. Prepare');expect(result.html).toContain('5. Optionally');expect(result.html).not.toContain('2. Check');
});
it('never includes omitted personal words or flag states in the returned projection or HTML',()=>{
 const input=notes();input[tasks[1]]='NEVER DISCLOSE OMITTED';const result=preparePersonalTrialReport([tasks[1],tasks[4]],input,[1,5]);expect(JSON.stringify(result)).not.toContain('NEVER DISCLOSE OMITTED');expect(JSON.stringify(result)).not.toContain(tasks[1]);expect(result.steps[1].flagged).toBe(true);expect(result.html).toContain('PRIVATE step 5');expect(result.html).not.toContain('PRIVATE step 3');expect(result.html).toContain('separate JSON always includes all five');expect(result.html).toContain('does not save this sheet scope');
});
it('does not automatically choose flagged steps or discard unflagged requested steps',()=>{
 const all=preparePersonalTrialReport([tasks[2]],notes()),one=preparePersonalTrialReport([tasks[2]],notes(),[4]);expect(all.ordinals).toEqual([1,2,3,4,5]);expect(all.steps).toHaveLength(5);expect(one.ordinals).toEqual([4]);expect(one.steps[0].flagged).toBe(false);expect(one.html).not.toContain('PRIVATE step 3');
});
it('refuses empty, duplicate, ranged, unsupported, long or malformed number selections',()=>{
 for(const text of['',' ','0','6','1,1','1-3','1 2','1,','1,,2','01','1;2','x','1'.repeat(26),null,1])expect(()=>parsePersonalTrialOrdinals(text)).toThrow();
 for(const values of[[],[1,1],[0],[6],[1.5],['1'],'1',false,{},[1,2,3,4,5,1]])expect(()=>preparePersonalTrialReport([],notes(),values)).toThrow();
});
it('still validates the complete bounded personal-value model and never returns a partial success for malformed hidden values',()=>{
 expect(()=>preparePersonalTrialReport([],{...notes(),[tasks[2]]:'x'.repeat(401)},[1])).toThrow();expect(()=>preparePersonalTrialReport(['unknown'],notes(),[1])).toThrow();
 const all=preparePersonalTrialReport([],notes(),[5,4,3,2,1]);expect(all.ordinals).toEqual([1,2,3,4,5]);expect(all.html).toContain('All instruction steps explicitly selected');expect(all.html).not.toContain('partial personal sheet');
});
