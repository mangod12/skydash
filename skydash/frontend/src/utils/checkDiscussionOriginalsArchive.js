import {renderPrivateDiscussionComparison} from './privateDiscussionSnapshotPacket';
import {prepareInstructorCombination} from './instructorCombination';
import {discussionSnapshotComparison} from './discussionSnapshotComparison';
import {renderDiscussionArchivePacket} from './discussionArchivePacket';
import {storedZipBytes} from './storedZip';
import {browserDiscussionHandoff} from './browserDiscussionHandoff';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const pin=value=>typeof value==='string'&&(value===''||/^[a-fA-F0-9]{64}$/.test(value));
const limits={'originals/source.csv':1048576,'originals/checklist.json':131072,'originals/instructor.json':262144,'validation.json':65536,'HANDOFF.txt':16384};
const paths={source:'originals/source.csv',checklist:'originals/checklist.json',instructor:'originals/instructor.json'};
async function checked(file,{expectedArchiveSha256='',expected={}}={}){
 if(!file||!Number.isSafeInteger(file.size)||file.size<22||file.size>2*1024*1024||typeof file.arrayBuffer!=='function'||!pin(expectedArchiveSha256)||!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).some(role=>!Object.hasOwn(paths,role)||!pin(expected[role])))throw Error('Bounded archive and explicit expectations required.');
 const bytes=new Uint8Array(await file.arrayBuffer()).slice();if(bytes.length!==file.size||bytes.length>2*1024*1024)throw Error('Changed archive size.');const archiveDigest=await digest(bytes);if(expectedArchiveSha256&&expectedArchiveSha256.toLowerCase()!==archiveDigest)throw Error('Independent archive expectation mismatch.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),entries=[];let offset=0;
 while(offset+4<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
  if(entries.length>=5||offset+30>bytes.length)throw Error('Unsupported entry count/header.');
  const size=view.getUint32(offset+22,true),length=view.getUint16(offset+26,true),start=offset+30+length;
  if(size!==view.getUint32(offset+18,true)||!length||length>128||view.getUint16(offset+28,true)!==0||start+size>bytes.length)throw Error('Unsupported stored entry.');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(offset+30,start));if(!Object.hasOwn(limits,name)||size<1||size>limits[name])throw Error('Unsupported path or size.');entries.push([name,bytes.subarray(start,start+size)]);offset=start+size;
 }
 const rebuilt=storedZipBytes(entries);if(rebuilt.length!==bytes.length||rebuilt.some((byte,index)=>byte!==bytes[index]))throw Error('Unsupported ZIP encoding or integrity.');
 const instructor=entries.length===5,wanted=instructor?['originals/source.csv','originals/checklist.json','originals/instructor.json','validation.json','HANDOFF.txt']:['originals/source.csv','originals/checklist.json','validation.json','HANDOFF.txt'];if(entries.map(([name])=>name).join('|')!==wanted.join('|'))throw Error('Unsupported discussion layout.');
 const originals=new Map(entries),original=role=>{const data=originals.get(paths[role]);return {size:data.length,arrayBuffer:async()=>data};};
 // All originals are freshly checked, never the received receipt/guide. Packing here is
 // memory-only validation reuse: its generated ZIP is discarded, never downloaded.
 const fresh=await browserDiscussionHandoff({source:original('source'),checklist:original('checklist'),instructor:instructor?original('instructor'):null},{includeSensitiveOriginals:true,includeInstructor:instructor,expected});
 const summary={archiveDigest,expectedArchiveDigestMatched:expectedArchiveSha256!=='',fileCount:entries.length,source:fresh.receipt.source,savedPrompts:fresh.receipt.saved_prompts,instructorIncluded:instructor,savedInstructorMarkers:fresh.receipt.saved_instructor_markers,originals:fresh.receipt.originals};return {summary,originals};
}
export async function checkDiscussionOriginalsArchive(file,options={}){return (await checked(file,options)).summary;}
export async function selectedDiscussionArchiveOriginal(file,{includeSensitiveOriginal=false,role,validatedArchiveSha256='',...options}={}){
 if(includeSensitiveOriginal!==true||!Object.hasOwn(paths,role)||!pin(validatedArchiveSha256))throw Error('Explicit sensitive acknowledgement and original role required.');const result=await checked(file,options);if(validatedArchiveSha256&&result.summary.archiveDigest!==validatedArchiveSha256.toLowerCase())throw Error('Changed checked archive.');if(role==='instructor'&&!result.summary.instructorIncluded)throw Error('Instructor original absent.');return {summary:result.summary,role,bytes:result.originals.get(paths[role]).slice(),originalDigest:result.summary.originals[role].sha256};
}

// Separate full sensitive print. Receipt/guide stay inert and never enter the renderer.
export async function privateDiscussionArchivePacket(file,{includePrivateReview=false,validatedArchiveSha256='',...options}={}){
 if(includePrivateReview!==true||!pin(validatedArchiveSha256))throw Error('Explicit private acknowledgement and supported checked digest required.');
 const result=await checked(file,options);if(validatedArchiveSha256&&validatedArchiveSha256.toLowerCase()!==result.summary.archiveDigest)throw Error('Changed checked archive.');return renderDiscussionArchivePacket(result.originals,result.summary);
}

// Read-only two-snapshot counts, never a replacement/import or private word report.
export async function compareDiscussionArchiveSnapshots(leftFile,rightFile,{left={},right={}}={}){
 const one=await checked(leftFile,left),two=await checked(rightFile,right);return discussionSnapshotComparison(one,two);
}

// Same explicit private decisions, now from two whole checked discussion ZIPs.
export async function prepareReceivedDiscussionInstructorCombination(leftFile,rightFile,{allowPrivateReview=false,left={},right={}}={}){
 if(allowPrivateReview!==true||!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)||Array.isArray(right))throw Error('Explicit private acknowledgement and separate options required.');
 const one=await checked(leftFile,left),two=await checked(rightFile,right);
 if(one.summary.originals.source.sha256!==two.summary.originals.source.sha256||!one.summary.instructorIncluded||!two.summary.instructorIncluded)throw Error('Same exact raw CSV and both actual instructor originals required.');
 const file=(archive,name)=>{const bytes=archive.originals.get(name);return {size:bytes.length,arrayBuffer:async()=>bytes};};
 // Only actual caller raw-file expectations cross into the three-original preview.
 // Whole-ZIP pins and freshly generated digests never become independent raw pins.
 const expected={source:left.expected?.source||right.expected?.source||'',left:left.expected?.instructor||'',right:right.expected?.instructor||''};
 const snapshot=await prepareInstructorCombination({source:file(one,'originals/source.csv'),left:file(one,'originals/instructor.json'),right:file(two,'originals/instructor.json')},{allowPrivateReview:true,expected});
 return {...snapshot,archiveEvidence:{left:one.summary,right:two.summary}};
}

// Separate full-private output, never an authorization to merge/replace or share.
export async function privateDiscussionSnapshotPacket(leftFile,rightFile,{includePrivateReview=false,left={},right={}}={}){
 if(includePrivateReview!==true||!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)||Array.isArray(right)||!pin(left.validatedArchiveSha256===undefined?'':left.validatedArchiveSha256)||!pin(right.validatedArchiveSha256===undefined?'':right.validatedArchiveSha256))throw Error('Explicit private acknowledgement and supported checked digests required.');
 const one=await checked(leftFile,left),two=await checked(rightFile,right);
 for(const[result,options]of[[one,left],[two,right]])if(options.validatedArchiveSha256&&options.validatedArchiveSha256.toLowerCase()!==result.summary.archiveDigest)throw Error('Changed checked archive.');
 return renderPrivateDiscussionComparison(one,two);
}
