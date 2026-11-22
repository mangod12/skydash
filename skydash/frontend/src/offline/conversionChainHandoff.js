import {CHAIN_ROLES,reproduceConversionChain} from './conversionChain';
import {storedZipBytes} from '../utils/storedZip';
export const CHAIN_ORIGINAL_PATHS=Object.freeze({original:'originals/timestamp-source.csv',timestamp_recipe:'originals/timestamp-recipe.json',intermediate:'originals/shared-intermediate.csv',mapping_recipe:'originals/numeric-mapping-recipe.json',converted:'originals/final-numeric.csv'});
export const CHAIN_ORIGINALS_GUIDE=`SKYDASH / COMPLETE SENSITIVE CONVERSION-CHAIN ORIGINALS

This unencrypted unsigned ZIP includes all five complete selected raw files, including private coordinates, source timestamps, readings, unknown/formula-like cells, header names and recipe labels. It is not redacted. Original filenames are replaced by fixed role paths. Confirm the audience and use secure transport yourself. Nothing was uploaded or shared.

originals/timestamp-source.csv, originals/timestamp-recipe.json, originals/shared-intermediate.csv, originals/numeric-mapping-recipe.json and originals/final-numeric.csv preserve exact selected bytes, including BOM, whitespace and line endings. validation.json is a freshly generated editable metadata receipt, not independent proof or authentication. HANDOFF.txt is fixed guidance, never executable code. No source code is included. Fixed ZIP timestamps are not observation or creation times.

Extract with a separate trusted archive tool into a new private directory. Do not execute received code, open CSV cells in a formula-executing spreadsheet or trust this guide, receipt or co-delivered hashes as authority. This ZIP is not accepted by the received training-package or discussion-originals ZIP tools.

Freshly check all five extracted files with a separate trusted SkyDash checkout using the standalone complete timestamp-to-numeric chain checker. Obtain optional complete raw-file expectations separately through a trusted route. Both fresh nominal timestamp and WGS84 source-coordinate statements must come from the recipient's own inspection, not this archive or its receipt. Alternatively, from a trusted checkout's skydash/frontend directory, run:
npm run --silent verify-conversion-chain -- SOURCE.csv TIMESTAMP-RECIPE.json INTERMEDIATE.csv MAPPING-RECIPE.json FINAL.csv --confirm-nominal --confirm-wgs84

Replace placeholders with explicit extracted paths using safe shell quoting. These flags are fresh caller statements, not claims that the archive can establish source meaning. CLI output is metadata only and does not apply optional independent pins; use the browser checker for those.

Both stages must reproduce exact bytes through the same intermediate. Nominal UTC calendar arithmetic assumes 86,400-second days, not leap-second-aware physical elapsed time. A coherent rewritten chain can still match; byte agreement does not verify clocks, source meanings, units, WGS84, authorship/custody, aircraft/OEM compatibility or telemetry truth. Numeric conversion may exclude extra source columns and subtract its configured time origin. Existing numeric lineage/cases do not acquire timestamp provenance from this separate receipt.

Manual replay use is separate. Protect existing unsaved work first. Inspect the final numeric CSV before choosing it in recorded replay, or explicitly prepare/map originals again with fresh semantic decisions. No automatic opening, source/comparison replacement, recipe import or review import is authorized by this archive.

This is not a complete workspace backup. It excludes human conversion records, notes, markers, saved copies, comparison, review drafts, recovery, device library and account state. Keep those separately. Not identity, grades, completion, readiness or flight-clearance evidence. No source repair, extraction, storage, network, sharing or aircraft commands are performed by preparing this archive. Verify saving and contents yourself.
`;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
export async function prepareConversionChainHandoff(files,{includeSensitiveOriginals=false,confirmedNominal=false,confirmedWGS84=false,expected={}}={}){
 if(includeSensitiveOriginals!==true||confirmedNominal!==true||confirmedWGS84!==true)throw Error('Fresh sensitive-original, nominal timestamp and WGS84 statements are all required before any read.');
 // Capture every handle, read method, byte claim and caller pin before the first await.
 const selected=CHAIN_ROLES.map(role=>{const file=files?.[role],size=file?.size,pin=expected?.[role]??'',limit=role.endsWith('_recipe')?65536:1048576;if(!file||!Number.isSafeInteger(size)||size<1||size>limit||typeof file.arrayBuffer!=='function'||typeof pin!=='string'||pin!==''&&!/^[a-fA-F0-9]{64}$/.test(pin))throw Error('Five bounded originals and valid optional expectations are required.');return {role,size,limit,pin,read:file.arrayBuffer.bind(file)};});
 const originals={};
 const snapshots=Object.fromEntries(selected.map(({role,size,limit,read})=>[role,{size,arrayBuffer:async()=>{const bytes=new Uint8Array(await read());if(bytes.length!==size||bytes.length>limit)throw Error('Selected original byte count changed.');const copy=new Uint8Array(bytes);originals[role]=copy;return copy;}}]));
 const receipt=await reproduceConversionChain(snapshots,{confirmedNominal:true,confirmedWGS84:true,expected:Object.fromEntries(selected.map(({role,pin})=>[role,pin]))});
 // Only the private captured copies that actually passed both stages enter the ZIP.
 const entries=[...CHAIN_ROLES.map(role=>[CHAIN_ORIGINAL_PATHS[role],originals[role]]),['validation.json',JSON.stringify(receipt,null,2)+'\n'],['HANDOFF.txt',CHAIN_ORIGINALS_GUIDE]],bytes=storedZipBytes(entries);
 return {bytes,archiveDigest:await digest(bytes),fileCount:entries.length,receipt};
}
