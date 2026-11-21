import {LOG_VERSION,parseFlightCSV} from './flightLog';
import {MARKER_KINDS,readDebriefSidecar} from './instructorDebrief';
import {storedZipBytes} from './storedZip';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const decode=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
export const instructorHandoffGuide=`SKYDASH / SENSITIVE INSTRUCTOR ORIGINALS HANDOFF

This unencrypted unsigned ZIP contains complete original CSV and instructor JSON, including private coordinates/readings, IDs, marker notes and discussion summary. Not redacted. Confirm audiences and secure transport separately. No upload/sharing performed.

Only originals/source.csv and originals/instructor.json preserve original raw bytes; original filenames are not retained. validation.json is an editable generated receipt, not an independent expectation, signature, trusted code, authorship/custody, source truth, completion or readiness proof. HANDOFF.txt is guidance, not executable code.

Extract with a separate trusted archive tool into a new private directory. This ZIP is not accepted by the separate received training-package ZIP tool. Revalidate these extracted originals using a separate trusted SkyDash checkout: node scripts/verify-instructor-sidecar.mjs SOURCE.csv SIDECAR.json. Replace placeholders with the extracted paths using safe shell quoting. Obtain optional independent raw-file SHA-256 expectations through a separate trusted route; never treat co-delivered hashes/receipts as authentication or execute received code.

To manually reopen: choose originals/source.csv in recorded replay, then preview/import originals/instructor.json and explicitly confirm. Protect existing unsaved work first. No automatic opening/confirmation.

Excludes analyst notes, training envelope criteria, notebook, comparison, original mapping sources/recipes, unadded drafts, recovery and device library. Not a complete workspace backup or handoff certificate. Preserve originals and excluded work separately. Fixed archive timestamps are not observation/creation times. No source repair, extraction, storage, network, upload/sharing, aircraft commands, grades, completion or readiness claims.
`;
async function original(file,limit,expected){
 if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>limit||typeof file.arrayBuffer!=='function')throw Error('Bounded original required.');
 const bytes=new Uint8Array(await file.arrayBuffer()).slice();if(bytes.byteLength!==file.size||bytes.byteLength>limit)throw Error('Changed or oversized original.');
 const sha256=await digest(bytes);if(expected!==''&&sha256!==expected.toLowerCase())throw Error('Independent expectation mismatch.');return {bytes,sha256};
}
export async function browserInstructorHandoff(sourceFile,sidecarFile,{includeSensitiveOriginals=false,expectedSourceSha256='',expectedSidecarSha256=''}={}){
 if(includeSensitiveOriginals!==true)throw Error('Explicit sensitive-original acknowledgement required.');
 for(const expected of[expectedSourceSha256,expectedSidecarSha256])if(typeof expected!=='string'||(expected!==''&&!/^[a-fA-F0-9]{64}$/.test(expected)))throw Error('Invalid independent expectation.');
 const source=await original(sourceFile,1024*1024,expectedSourceSha256),sidecar=await original(sidecarFile,256*1024,expectedSidecarSha256);
 const log={sha256:source.sha256,model_version:LOG_VERSION,samples:parseFlightCSV(decode(source.bytes))},review=readDebriefSidecar(decode(sidecar.bytes),log);
 // Re-read mutable caller file-like objects before copying only the validated original bytes.
 const sourceCopy=await original(sourceFile,1024*1024,source.sha256),sidecarCopy=await original(sidecarFile,256*1024,sidecar.sha256);
 const receipt={format:'skydash-instructor-sidecar-validation-receipt-v1',exact_source_sha256:source.sha256,exact_sidecar_sha256:sidecar.sha256,expected_source_digest_matched:expectedSourceSha256!=='',expected_sidecar_digest_matched:expectedSidecarSha256!=='',replay_model:LOG_VERSION,sidecar_format:review.format,source:{samples:log.samples.length,start_s:0,end_s:log.samples.at(-1).time_s},saved_markers:review.markers.length,marker_kinds:Object.fromEntries(MARKER_KINDS.map(kind=>[kind,review.markers.filter(marker=>marker.kind===kind).length])),scope:'Fresh actual-app validation of complete original CSV and matching instructor sidecar, with separate optional independent raw-file expectations. No private filenames, IDs, note text, coordinates or individual readings in this receipt. Hashes/counts/times remain sensitive. Editable unsigned projection, not independent evidence, identity/authorship/custody, source truth, training completion or readiness. First-to-last span is not continuous observation. Sidecar contains no CSV. No source repair, workspace changes, automatic opening, storage, network, upload/sharing or aircraft commands.'};
 const entries=[['originals/source.csv',sourceCopy.bytes],['originals/instructor.json',sidecarCopy.bytes],['validation.json',JSON.stringify(receipt,null,2)],['HANDOFF.txt',instructorHandoffGuide]],bytes=storedZipBytes(entries);
 return {bytes,archiveDigest:await digest(bytes),receipt,fileCount:entries.length};
}
