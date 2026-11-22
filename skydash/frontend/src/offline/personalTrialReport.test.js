import {expect,it} from 'vitest';
import {preparePersonalTrialReport,personalTrialStepTitles} from './personalTrialReport';
import {trialFollowupTasks as tasks} from './guidedTrialFollowup';
const notes=()=>Object.fromEntries(tasks.map(task=>[task,'']));
it('preserves all five exact personal values with safe literal HTML and no unrelated inputs or executable tags',()=>{
 const input=notes();input[tasks[0]]='PRIVATE <img src=x onerror=alert(1)>\n<script>bad()</script> & "quoted"';input[tasks[4]]='最後の質問';
 const before=JSON.stringify(input),result=preparePersonalTrialReport([tasks[2]],input);
 expect(result.value.steps).toHaveLength(5);expect(result.value.steps[0].note).toBe(input[tasks[0]]);expect(result.value.steps[4].note).toBe('最後の質問');expect(result.value.steps[2].flagged).toBe(true);expect(JSON.stringify(input)).toBe(before);
 expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');expect(result.html).toContain('&lt;script&gt;bad()&lt;/script&gt;');expect(result.html).not.toMatch(/<(script|iframe|img|form|input)\b|https?:\/\//i);expect(result.html).toContain("default-src 'none'");expect(result.html).toContain('@media print');expect(result.html).toContain('size:A4');expect(result.html).toContain('Neither means complete');expect(result.html).toContain('not a backup');expect(result.html).toContain('Nothing has been sent');for(const title of personalTrialStepTitles)expect(result.html).toContain(title);
});
it('uses the existing strict personal-value model rather than accepting extra fields, unknown flags or long notes',()=>{
 for(const [flags,value]of[[['unknown'],notes()],[[tasks[0],tasks[0]],notes()],[[],{...notes(),source:'PRIVATE outside original'}],[[],{...notes(),[tasks[0]]:'x'.repeat(401)}],[[],{...notes(),[tasks[1]]:null}]])expect(()=>preparePersonalTrialReport(flags,value)).toThrow();
});
it('captures independent values so later caller changes do not change the prepared HTML or snapshot',()=>{
 const values=notes(),flags=[tasks[1]],result=preparePersonalTrialReport(flags,values);values[tasks[1]]='Later private draft';flags.length=0;expect(result.value.steps[1]).toEqual({task:tasks[1],flagged:true,note:''});expect(result.html).not.toContain('Later private draft');expect((result.html.match(/Neither means complete/g)||[])).toHaveLength(5);
});
