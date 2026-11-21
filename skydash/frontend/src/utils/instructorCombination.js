import {LOG_VERSION,parseFlightCSV} from './flightLog';
import {debriefSidecar,readDebriefSidecar} from './instructorDebrief';
import {instructorReplacement} from './instructorReplacement';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function original(file,limit,expected){if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>limit||typeof file.arrayBuffer!=='function')throw Error('Bounded original required.');const bytes=new Uint8Array(await file.arrayBuffer()).slice();if(bytes.byteLength!==file.size||bytes.byteLength>limit)throw Error('Changed original size.');const sha256=await digest(bytes);if(expected!==''&&sha256!==expected.toLowerCase())throw Error('Independent expectation mismatch.');return {text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256};}
export async function prepareInstructorCombination(files,{allowPrivateReview=false,expected={}}={}){
 if(allowPrivateReview!==true)throw Error('Explicit private-review acknowledgement required.');
 if(!files||Object.keys(files).sort().join(',')!=='left,right,source'||Object.keys(expected).some(key=>!['source','left','right'].includes(key)))throw Error('Explicit source and two originals required.');
 const pins=Object.fromEntries(['source','left','right'].map(role=>[role,expected[role]===undefined?'':expected[role]]));for(const value of Object.values(pins))if(typeof value!=='string'||(value!==''&&!/^[a-fA-F0-9]{64}$/.test(value)))throw Error('Invalid independent expectation.');
 const raw={};for(const role of['source','left','right'])raw[role]=await original(files[role],role==='source'?1024*1024:256*1024,pins[role]);
 const log={model_version:LOG_VERSION,sha256:raw.source.sha256,samples:parseFlightCSV(raw.source.text)},left=readDebriefSidecar(raw.left.text,log),right=readDebriefSidecar(raw.right.text,log),comparison=instructorReplacement(log,left.markers,left.notes,right);
 const rows=comparison.rows.map(row=>({id:row.id,left:row.before,right:row.after,conflict:row.kind==='changed',fields:row.fields}));
 return {log,left,right,rows,digests:Object.fromEntries(Object.entries(raw).map(([role,value])=>[role,value.sha256])),expectedMatched:Object.fromEntries(Object.entries(pins).map(([role,value])=>[role,value!=='']))};
}
export function combineInstructorReviews(snapshot,selections,summaryChoice){
 if(!Array.isArray(selections)||selections.length!==snapshot.rows.length||!['left','right','empty'].includes(summaryChoice))throw Error('Resolve every annotation and the whole summary explicitly.');
 const chosen=new Map();for(const item of selections){if(!item||Object.keys(item).sort().join(',')!=='choice,id'||typeof item.id!=='string'||chosen.has(item.id)||!['left','right','omit'].includes(item.choice))throw Error('Invalid explicit selection.');chosen.set(item.id,item.choice);}
 const markers=[];for(const row of snapshot.rows){const choice=chosen.get(row.id);if(!choice)throw Error('Annotation selection missing.');if(choice==='omit')continue;if(!row[choice])throw Error('Selected side is absent.');markers.push({...row[choice]});}
 const notes=summaryChoice==='empty'?'':snapshot[summaryChoice].notes;
 // Existing sidecar schema and bounds, never imported success claims or concatenated notes.
 return debriefSidecar(snapshot.log,markers,notes);
}
