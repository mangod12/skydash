import { LOG_VERSION } from './flightLog';
export const ACTION_VERSION='skydash-debrief-actions-v1';
export const MAX_ACTIONS=50;
export const MAX_ACTION_BYTES=256*1024;
export const ACTION_STATES=['Open','In progress','Closed'];
export const ACTION_SCOPE='REVIEWER-AUTHORED DEBRIEF ACTION REGISTER. Action text, owner labels, target text, status and closure notes are unverified human annotations, not sensor facts, accepted assignments, notifications, reminders, verified completion, pilot grades or training certification. Original source-row references provide discussion context only. No action is sent to another person or aircraft. Closing an item records the reviewer assertion only.';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const text=(value,max,required=false)=>typeof value==='string'&&value.length<=max&&(!required||Boolean(value.trim()));
export function validateDebriefActions(log,items){
 if(log?.model_version!==LOG_VERSION||!/^[a-f0-9]{64}$/.test(log.sha256))throw new Error('Load a supported exact recorded source before using debrief actions.');
 if(!Array.isArray(items)||items.length>MAX_ACTIONS)throw new Error('At most 50 debrief actions are supported.');
 const ids=new Set();return items.map(item=>{
  if(!exact(item,['id','row','text','owner','target','status','closure'])||!text(item.id,80,true)||!/^[a-zA-Z0-9_-]+$/.test(item.id)||ids.has(item.id))throw new Error('Invalid action fields or duplicate identity.');ids.add(item.id);
  if(!Number.isInteger(item.row)||item.row<1||item.row>log.samples.length)throw new Error('Action reference must be an existing whole original data row.');
  if(!text(item.text,1000,true)||!text(item.owner,120)||!text(item.target,120)||!text(item.closure,1000)||!ACTION_STATES.includes(item.status))throw new Error('Invalid action text, owner/target label, status or closure note.');
  if(item.status==='Closed'&&!item.closure.trim())throw new Error('Closed actions require a reviewer closure note, not proof of completion.');
  return {...item};
 });
}
export function actionRegister(log,items){
 const data={format:ACTION_VERSION,replay_model:LOG_VERSION,source_sha256:log.sha256,items:validateDebriefActions(log,items)};
 if(new Blob([JSON.stringify(data,null,2)]).size>MAX_ACTION_BYTES)throw new Error('Debrief action register exceeds 256KiB. Shorten notes before exporting.');return data;
}
export function readActionRegister(text,log){
 if(typeof text!=='string'||new Blob([text]).size>MAX_ACTION_BYTES)throw new Error('Action register must be at most 256KiB.');let data;try{data=JSON.parse(text);}catch{throw new Error('Action register is not valid JSON.');}
 if(!exact(data,['format','replay_model','source_sha256','items'])||data.format!==ACTION_VERSION||data.replay_model!==LOG_VERSION)throw new Error('Unsupported action register fields or models.');
 if(data.source_sha256!==log?.sha256)throw new Error('Source fingerprint mismatch. Load the exact original CSV before importing its actions.');return actionRegister(log,data.items);
}
export function actionRegisterReport(log,items){
 const data=actionRegister(log,items),show=(value,unit='')=>value===null?'unknown':String(value)+unit;
 return ['SKYDASH / DEBRIEF ACTION REGISTER',ACTION_VERSION,ACTION_SCOPE,`Replay model: ${LOG_VERSION}`,`Source: ${log.filename}; exact SHA-256: ${log.sha256}`,`Saved items: ${data.items.length}; ${ACTION_STATES.map(status=>`${status}: ${data.items.filter(item=>item.status===status).length}`).join('; ')}. All saved items in reviewer insertion order, independent of UI filter/page.`,'',...data.items.flatMap((item,index)=>{const sample=log.samples[item.row-1],spacing=item.row>1?sample.time_s-log.samples[item.row-2].time_s:null;return [`${index+1}. ${item.status} / ID ${item.id}`,`Reviewer action: ${item.text}`,`Owner label (not notified/accepted): ${item.owner||'(none)'}`,`Target text (not scheduled or interpreted): ${item.target||'(none)'}`,`Reviewer closure note (not verified completion): ${item.closure||'(none)'}`,`Original data row ${item.row} at ${sample.time_s}s; previous original spacing ${spacing===null?'none, first row':`${spacing}s${spacing>5?' / gap over 5s':''}`}. Exact referenced sample, not a claim about unsampled intervals.`,`Source altitude ${show(sample.altitude_m,'m')}; ground speed ${show(sample.ground_speed_m_s,'m/s')}; battery ${show(sample.battery_pct,'%')}. Datum unverified, ground speed not airspeed, percentage not energy.`, ''];}),'Keep exact source CSV and JSON register to reopen. Source context recomputed from CSV, no imported evidence/statistics accepted. Report omits coordinates but includes fingerprints/times/private action text and labels. Matching source hash does not authenticate author or completion. Editable, not signed or tamper-evident. Session-only, excluded from primary cases/comparison/notebooks/library; download separately. No backend writes, automatic storage/sharing/messages/reminders or aircraft commands.'].join('\n');
}
