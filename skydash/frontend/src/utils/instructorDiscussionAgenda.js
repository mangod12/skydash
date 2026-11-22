import {LOG_VERSION,parseFlightCSV} from './flightLog';
import {readDebriefSidecar} from './instructorDebrief';
import {checklistReview,checklistTemplate} from './debriefChecklist';
import {recordedObservation} from './flightComparison';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function original(file,limit,expected){if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>limit||typeof file.arrayBuffer!=='function')throw Error('Bounded original required.');const bytes=new Uint8Array(await file.arrayBuffer()).slice();if(bytes.byteLength!==file.size||bytes.byteLength>limit)throw Error('Changed original size.');const sha256=await digest(bytes);if(expected!==''&&sha256!==expected.toLowerCase())throw Error('Independent expectation mismatch.');return {text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256};}
export async function prepareInstructorAgenda(sourceFile,sidecarFile,{allowPrivateReview=false,expectedSourceSha256='',expectedSidecarSha256=''}={}){
 if(allowPrivateReview!==true)throw Error('Explicit private-review acknowledgement required.');for(const value of[expectedSourceSha256,expectedSidecarSha256])if(typeof value!=='string'||(value!==''&&!/^[a-fA-F0-9]{64}$/.test(value)))throw Error('Invalid independent expectation.');
 const source=await original(sourceFile,1024*1024,expectedSourceSha256),sidecar=await original(sidecarFile,256*1024,expectedSidecarSha256),log={model_version:LOG_VERSION,sha256:source.sha256,samples:parseFlightCSV(source.text)},review=readDebriefSidecar(sidecar.text,log);
 return {log,review,sourceDigest:source.sha256,sidecarDigest:sidecar.sha256,expectedSourceMatched:expectedSourceSha256!=='',expectedSidecarMatched:expectedSidecarSha256!=='',rows:review.markers.map(marker=>{const evidence=recordedObservation(log.samples,marker.time_s);return {marker,heldRow:evidence.index+1,sourceTime:evidence.sample.time_s,age:evidence.ageS,gap:evidence.state==='gap'};})};
}
export function instructorDiscussionAgenda(snapshot,title,selections){
 if(!snapshot||!Array.isArray(selections)||selections.length<1||selections.length>30)throw Error('Explicitly select 1 to 30 annotations.');const byId=new Map(snapshot.rows.map(row=>[row.marker.id,row])),seen=new Set();
 const items=selections.map((selection,index)=>{if(!selection||Object.keys(selection).sort().join(',')!=='id,prompt,reference'||!byId.has(selection.id)||seen.has(selection.id)||typeof selection.prompt!=='string'||!['none','held'].includes(selection.reference))throw Error('Invalid explicit agenda choice.');seen.add(selection.id);const original=byId.get(selection.id);return {id:'instructor-agenda-'+(index+1),prompt:selection.prompt,status:'Pending',note:'',row:selection.reference==='held'?original.heldRow:null};});
 const review=checklistReview(snapshot.log,title,items),template=checklistTemplate(snapshot.log,title,items);
 return {review,template};
}
