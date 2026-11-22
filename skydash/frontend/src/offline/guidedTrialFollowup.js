// Personal trial follow-up only. Never reads originals, checks, replay or tool use.
export const trialFollowupTasks=Object.freeze(['discussionExamples','discussionIntake','discussionCompare','checklistCombine','receivedDiscussion']);
export const trialNoteLimit=400;
export const trialFollowupByteLimit=16384;
const format='skydash-fabricated-trial-followup';
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const refuse=()=>{throw new Error('Personal trial follow-up file refused.');};
export function validateTrialFollowup(value){
 if(!exactKeys(value,['format','version','steps'])||value.format!==format||value.version!==1||!Array.isArray(value.steps)||value.steps.length!==trialFollowupTasks.length)refuse();
 const steps=value.steps.map((step,index)=>{
  if(!exactKeys(step,['task','flagged','note'])||step.task!==trialFollowupTasks[index]||typeof step.flagged!=='boolean'||typeof step.note!=='string'||step.note.length>trialNoteLimit)refuse();
  return {task:step.task,flagged:step.flagged,note:step.note};
 });
 return {format,version:1,steps};
}
export function createTrialFollowup(flags,notes){
 if(!Array.isArray(flags)||new Set(flags).size!==flags.length||flags.some(task=>!trialFollowupTasks.includes(task))||!exactKeys(notes,trialFollowupTasks))refuse();
 return validateTrialFollowup({format,version:1,steps:trialFollowupTasks.map(task=>({task,flagged:flags.includes(task),note:notes[task]}))});
}
export function serializeTrialFollowup(flags,notes){
 const text=JSON.stringify(createTrialFollowup(flags,notes),null,2)+'\n';
 if(new TextEncoder().encode(text).length>trialFollowupByteLimit)refuse();
 return text;
}
export function parseTrialFollowup(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>trialFollowupByteLimit)refuse();
 try{return validateTrialFollowup(JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)));}catch{refuse();}
}
