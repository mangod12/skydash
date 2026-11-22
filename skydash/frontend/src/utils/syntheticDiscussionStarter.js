import {SAMPLE_LOG,LOG_VERSION,parseFlightCSV,flightCSVHash} from './flightLog';
import {checklistReview} from './debriefChecklist';
import {debriefSidecar} from './instructorDebrief';
import {browserDiscussionHandoff} from './browserDiscussionHandoff';
import {checkDiscussionIntake} from './discussionIntake';
const file=text=>{const bytes=typeof text==='string'?new TextEncoder().encode(text):text;return {size:bytes.length,arrayBuffer:async()=>bytes};};
export const syntheticDiscussionStarterGuide=`SKYDASH / FIXED SYNTHETIC DISCUSSION EXAMPLES

Every CSV, checklist and instructor original here is fixed fabricated demonstration data, not real recordings, people, timestamps, OEM compatibility or completed training. The example generator reads no selected files, workspace, library, account or device storage. It opens, changes, extracts and shares nothing. All source intervals remain unsampled; the synthetic 4s-to-12s gap is deliberately retained with missing channel cells.

Save the three separately prepared ZIPs yourself. In the separate discussion intake queue, explicitly choose those saved files and check them. The two five-entry examples contain differing whole checklists and instructor annotations over the same exact fabricated CSV. The third four-entry example omits instructor; absence is not an empty review, deletion or completion. The common source is one reused fabricated source, not three independent flights. Selection positions and filenames are not revision chronology, author, student or aircraft identity.

To inspect original words, deliberately choose the two five-entry ZIPs in the separate discussion snapshot comparison. Its aggregate check reveals no private original words. Its private comparison and whole-component handoff each require their own acknowledgements. The separate explicit checklist/instructor combination tools require their own private-preview consent and unresolved whole-item choices. Same IDs are fabricated exercise inputs, not verified shared authorship or consensus. No automatic file transfer, inferred choice, candidate preparation or active review replacement occurs.

Existing receiver tools can recheck an example ZIP, then download an explicitly chosen original only after their own acknowledgement. Opening CSV/checklist/instructor into replay still needs separate manual selection and each existing replacement confirmation. Protect unsaved real work first. Never use these synthetic annotations as operational instructions, an approved preflight checklist, a grade, certification, readiness or flight clearance.

These are the standard unencrypted unsigned discussion-original ZIPs, not training-package ZIPs. The original bytes pass the same current validators/packer/intake checks used for supplied files. Generated hashes are reproducibility fingerprints, never independent expectations, authenticated authorship, history or custody. Do not paste generated hashes into independent expectation fields as proof. Received validation/guide claims remain inert. This guide is editable output, not trusted code or a complete workspace backup. No mapping/lineage originals or real private artifacts are included. No automatic download, extraction, import, storage, network, upload, sharing, backend changes or aircraft commands.
`;
export async function syntheticDiscussionStarter(...args){
 if(args.length)throw Error('Fixed synthetic generator accepts no inputs.');
 const log={model_version:LOG_VERSION,sha256:await flightCSVHash(SAMPLE_LOG),samples:parseFlightCSV(SAMPLE_LOG)},item=(id,prompt,status='Pending',note='',row=null)=>({id,prompt:'SYNTHETIC: '+prompt,status,note:note?'SYNTHETIC: '+note:'',row});
 const left=checklistReview(log,'SYNTHETIC left discussion',[item('synthetic-shared','Discuss the fabricated held gap'),item('synthetic-left-only','Ask a separate fabricated question','Discussed','Demo annotation only, not completion',4)]),right=checklistReview(log,'SYNTHETIC right discussion',[item('synthetic-right-only','Keep a different fabricated follow-up'),item('synthetic-shared','Inspect the different complete fabricated prompt','Not applicable','Fabricated reason, not an approved procedure',4)]);
 const instructor=(side,time)=>debriefSidecar(log,[{id:'synthetic-shared-marker',time_s:time,kind:'Question',text:'SYNTHETIC '+side+' instructor question, not a detected event',discussed:side==='left'}],'SYNTHETIC '+side+' whole discussion summary, not training evidence');
 const specs=[['left','skydash-synthetic-discussion-left.zip',left,instructor('left',8)],['right','skydash-synthetic-discussion-right.zip',right,instructor('right',12)],['no-instructor','skydash-synthetic-discussion-no-instructor.zip',left,null]],archives=[];
 for(const[key,filename,checklist,review]of specs){const prepared=await browserDiscussionHandoff({source:file(SAMPLE_LOG),checklist:file(JSON.stringify(checklist,null,2)+'\n'),instructor:review?file(JSON.stringify(review,null,2)+'\n'):null},{includeSensitiveOriginals:true,includeInstructor:review!==null});archives.push({key,filename,...prepared});}
 const intake=await checkDiscussionIntake(archives.map(value=>({file:file(value.bytes)})));if(intake.checked_archives!==3||intake.refused_archives!==0)throw Error('Complete synthetic originals must pass current intake.');
 return {format:'skydash-synthetic-discussion-starter-v1',archives,intake,guide:syntheticDiscussionStarterGuide};
}
