import {checkDiscussionOriginalsArchive} from './checkDiscussionOriginalsArchive';
const MAX_ARCHIVES=10,MAX_BYTES=2*1024*1024,pin=value=>typeof value==='string'&&(value===''||/^[a-fA-F0-9]{64}$/.test(value));
function entry(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['file','expectedArchiveSha256','expected'].includes(key)))throw Error('Explicit supported intake entries required.');
 const {file,expectedArchiveSha256='',expected={}}=value;
 if(!file||!Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_ARCHIVES*MAX_BYTES||typeof file.arrayBuffer!=='function'||!pin(expectedArchiveSha256)||!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).some(role=>!['source','checklist','instructor'].includes(role)||!pin(expected[role])))throw Error('Bounded complete archives and independent expectations required.');
 return {file,options:{expectedArchiveSha256,expected:{...expected}}};
}
export async function checkDiscussionIntake(entries){
 if(!Array.isArray(entries)||entries.length<1||entries.length>MAX_ARCHIVES)throw Error('Select one to ten complete discussion archives.');
 // Check the entire batch configuration before reading any file. Process serially,
 // retaining only privacy-limited inventories, never private originals or errors.
 const inputs=Array.from(entries,entry);if(inputs.reduce((sum,value)=>sum+value.file.size,0)>MAX_ARCHIVES*MAX_BYTES)throw Error('Intake byte bound exceeded.');
 const rows=[],archiveOrdinals=new Map(),sourceOrdinals=new Map();
 for(const[inputIndex,input]of inputs.entries()){
  const ordinal=inputIndex+1;
  try{
   const checked=await checkDiscussionOriginalsArchive(input.file,input.options),inventory={archiveDigest:checked.archiveDigest,expectedArchiveDigestMatched:checked.expectedArchiveDigestMatched,fileCount:checked.fileCount,source:{samples:checked.source.samples,start_s:checked.source.start_s,end_s:checked.source.end_s},savedPrompts:checked.savedPrompts,instructorIncluded:checked.instructorIncluded,savedInstructorMarkers:checked.savedInstructorMarkers,originals:Object.fromEntries(['source','checklist','instructor'].filter(role=>Object.hasOwn(checked.originals,role)).map(role=>{const item=checked.originals[role];return[role,{sha256:item.sha256,bytes:item.bytes,expected_digest_matched:item.expected_digest_matched}];}))},archive=inventory.archiveDigest,source=inventory.originals.source.sha256;
   rows.push({ordinal,state:'checked',inventory,archiveDigestMatchesEarlierOrdinal:archiveOrdinals.get(archive)??null,sourceDigestMatchesEarlierOrdinal:sourceOrdinals.get(source)??null});
   if(!archiveOrdinals.has(archive))archiveOrdinals.set(archive,ordinal);if(!sourceOrdinals.has(source))sourceOrdinals.set(source,ordinal);
  }catch{rows.push({ordinal,state:'refused'});}
 }
 return {format:'skydash-discussion-intake-v1',checked_archives:rows.filter(row=>row.state==='checked').length,refused_archives:rows.filter(row=>row.state==='refused').length,entries:rows,scope:'Separate complete-archive/current-original checks only. Hash/count/span metadata is sensitive, not anonymized. No original filenames, IDs, titles, prompts, notes, summaries, coordinates, readings or private error diagnostics. Earlier ordinal means earlier selection position only, never revision chronology, author/student/flight identity or shared lineage. Equal raw-source/archive digests are only byte-fingerprint relations, not independent authentication, consensus, review completeness, training completion, grades, certification or readiness. Failed entries have no verified originals or inferred absence. No cross-file prompt/annotation/status totals, field matching, private report, extracted original, repair or automatic replacement. Caller pins stay independent and separate; generated hashes never populate expectations. Editable unsigned report, not history/custody, a workspace backup or permission to share. Keep every input and excluded artifact separately. No automatic download, active-workspace reads/changes, storage, network, upload/sharing, backend writes or aircraft commands.'};
}
