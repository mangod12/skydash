import {checkDiscussionOriginalsArchive,selectedDiscussionArchiveOriginal} from './checkDiscussionOriginalsArchive';
import {browserDiscussionHandoff} from './browserDiscussionHandoff';
import {LOG_VERSION,parseFlightCSV} from './flightLog';
import {readChecklist} from './debriefChecklist';
import {readDebriefSidecar} from './instructorDebrief';
import {recordedObservation} from './flightComparison';
const decode=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),file=bytes=>({size:bytes.length,arrayBuffer:async()=>bytes}),hex=value=>typeof value==='string'&&/^[a-fA-F0-9]{64}$/.test(value),sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
function sideOptions(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['expectedArchiveSha256','expected','validatedArchiveSha256'].includes(key))||!hex(value.validatedArchiveSha256))throw Error('Previously checked complete archive binding required.');
 return {expectedArchiveSha256:value.expectedArchiveSha256===undefined?'':value.expectedArchiveSha256,expected:value.expected===undefined?{}:value.expected,validatedArchiveSha256:value.validatedArchiveSha256.toLowerCase()};
}
async function selection(leftFile,rightFile,{includePrivateReview=false,checklistSide='',instructorSide='',left={},right={},...unknown}={}){
 if(includePrivateReview!==true||Object.keys(unknown).length||!['left','right'].includes(checklistSide)||!['left','right','omit'].includes(instructorSide))throw Error('Explicit private acknowledgement and whole-component choices required.');
 const options={left:sideOptions(left),right:sideOptions(right)},files={left:leftFile,right:rightFile},inventory={};
 for(const side of['left','right']){inventory[side]=await checkDiscussionOriginalsArchive(files[side],options[side]);if(inventory[side].archiveDigest!==options[side].validatedArchiveSha256)throw Error('Changed checked archive.');}
 if(inventory.left.originals.source.sha256!==inventory.right.originals.source.sha256)throw Error('Same exact raw CSV required.');
 if(instructorSide!=='omit'&&!inventory[instructorSide].instructorIncluded)throw Error('Selected instructor original absent.');
 const take=async(side,role)=>(await selectedDiscussionArchiveOriginal(files[side],{...options[side],includeSensitiveOriginal:true,role})).bytes;
 const source=await take('left','source'),checklist=await take(checklistSide,'checklist'),instructor=instructorSide==='omit'?null:await take(instructorSide,'instructor');
 const log={model_version:LOG_VERSION,sha256:inventory.left.originals.source.sha256,samples:parseFlightCSV(decode(source))},checked=readChecklist(decode(checklist),log);if(checked.kind!=='review')throw Error('Source-bound checklist original required.');if(instructor)readDebriefSidecar(decode(instructor),log);
 // Instructor array order in this preview is the original JSON order, not the
 // normalized replay sort. Output always retains the complete original raw bytes.
 const instructorReview=instructor?JSON.parse(decode(instructor)):null;
 const checklistContext=checked.review.items.map(item=>{if(item.row===null)return null;const sample=log.samples[item.row-1];return {row:item.row,time:sample.time_s,previousSpacing:item.row>1?sample.time_s-log.samples[item.row-2].time_s:null};});
 const instructorContext=instructorReview?instructorReview.markers.map(marker=>{const value=recordedObservation(log.samples,marker.time_s);return {row:value.index+1,time:value.sample.time_s,age:value.ageS,state:value.state};}):null;
 const boundTo={leftArchiveSha256:inventory.left.archiveDigest,rightArchiveSha256:inventory.right.archiveDigest,checklistSide,instructorSide};
 const expected={source:options.left.expected.source||options.right.expected.source||'',checklist:options[checklistSide].expected.checklist||'',instructor:instructorSide==='omit'?'':options[instructorSide].expected.instructor||''};
 return {inventory,boundTo,source:{sha256:log.sha256,samples:log.samples.length,end_s:log.samples.at(-1).time_s},checklist:checked.review,instructor:instructorReview,checklistContext,instructorContext,raw:{source,checklist,instructor},expected};
}
export async function previewSelectedDiscussionHandoff(leftFile,rightFile,options={}){
 const {raw:ignoredRaw,expected:ignoredExpected,...preview}=await selection(leftFile,rightFile,options);void ignoredRaw;void ignoredExpected;return preview;
}
export async function packageSelectedDiscussionHandoff(leftFile,rightFile,{includeSensitiveOriginals=false,preview,...options}={}){
 if(includeSensitiveOriginals!==true||!sameKeys(preview,['leftArchiveSha256','rightArchiveSha256','checklistSide','instructorSide'])||!hex(preview.leftArchiveSha256)||!hex(preview.rightArchiveSha256))throw Error('Explicit sensitive-original acknowledgement and checked selection preview required.');
 if(preview.checklistSide!==options.checklistSide||preview.instructorSide!==options.instructorSide||preview.leftArchiveSha256.toLowerCase()!==options.left?.validatedArchiveSha256?.toLowerCase()||preview.rightArchiveSha256.toLowerCase()!==options.right?.validatedArchiveSha256?.toLowerCase())throw Error('Selection changed since preview.');
 const value=await selection(leftFile,rightFile,{...options,includePrivateReview:true});
 const result=await browserDiscussionHandoff({source:file(value.raw.source),checklist:file(value.raw.checklist),instructor:value.raw.instructor?file(value.raw.instructor):null},{includeSensitiveOriginals:true,includeInstructor:value.raw.instructor!==null,expected:value.expected});
 const selectionReceipt={format:'skydash-selected-discussion-handoff-v1',input_archives:value.inventory,selection:{source:'left CSV, exact raw bytes equal on both sides',checklist:value.boundTo.checklistSide,instructor:value.boundTo.instructorSide},output_archive_sha256:result.archiveDigest,output_originals:result.receipt.originals,scope:'Explicit whole-component selection only. Exact raw CSV plus one complete checklist and explicitly selected or omitted instructor original. No item/field blending, status transfer, semantic matching, checklist-instructor mapping, consensus, verified author identity, chronology, lineage, completion or readiness. Left/Right are chosen input sides, not identities. Omission affects only this new ZIP, never deletes originals. Input/selected raw caller pins remain separate; generated bindings/hashes are not independent expectations. Receipt is sensitive, unsigned editable metadata, not authenticated history/custody, a backup or permission to share. No original private words/IDs/filenames/coordinates/readings included here; ZIP contains exact complete private selected originals. Preserve both input ZIPs, this separate receipt and excluded work. No automatic download, extraction, replay changes, storage, network, sharing, notifications, backend writes or aircraft commands.'};
 return {...result,selectionReceipt};
}
