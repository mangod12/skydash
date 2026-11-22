import {CHAIN_ROLES,reproduceConversionChain} from './conversionChain';
import {CHAIN_ORIGINAL_PATHS} from './conversionChainHandoff';
import {storedZipBytes} from '../utils/storedZip';
export const RECEIVED_CHAIN_VERSION='skydash-received-conversion-chain-validation-v1';
export const RECEIVED_CHAIN_SCOPE='Fresh check of five actual originals in one exact canonical seven-entry stored conversion-chain ZIP. Archive encoding, complete-byte integrity and optional caller archive expectation are checked before original conversion models. Received validation.json and HANDOFF.txt are inert bounded bytes, never parsed, rendered, executed or used as success/identity/permission evidence. Original timestamp source and recipe must reproduce the exact shared intermediate; that SAME intermediate and numeric recipe must reproduce the exact final CSV. Optional separately supplied raw-file expectations remain distinct from the whole-archive expectation and generated fingerprints. Fresh nominal/WGS84 statements come from caller inspection, never the archive. Nominal UTC calendar arithmetic is not leap-second-aware physical elapsed time. A coherent rewritten archive can still match. Hashes, counts, byte sizes, column ordinal and nominal span remain sensitive. Unsigned metadata, not source-clock/unit/coordinate accuracy, source authenticity, authorship/custody, OEM compatibility, identity, grades, completion, readiness or flight clearance. No originals are returned or extracted to disk; no replay/mapper/comparison/review opening or replacement, source repair, storage, network, upload, sharing, backend write or aircraft command. Received claims and excluded human conversion records/review/workspace state are not validated or restored.';
const pin=value=>typeof value==='string'&&(value===''||/^[a-fA-F0-9]{64}$/.test(value));
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
export async function checkReceivedConversionChain(file,{confirmedNominal=false,confirmedWGS84=false,expectedArchiveSha256='',expected={}}={}){
 if(confirmedNominal!==true||confirmedWGS84!==true)throw Error('Both fresh interpretation statements are required before any archive read.');
 const size=file?.size,read=file?.arrayBuffer;
 if(!file||!Number.isSafeInteger(size)||size<22||size>4194304||typeof read!=='function'||!pin(expectedArchiveSha256)||!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).some(role=>!CHAIN_ROLES.includes(role)))throw Error('One bounded supported archive and valid separate expectations are required.');
 const archivePin=expectedArchiveSha256.toLowerCase(),pins=Object.fromEntries(CHAIN_ROLES.map(role=>{const value=expected[role]??'';if(!pin(value))throw Error('Invalid original expectation.');return [role,value];})),readSelected=read.bind(file);
 const raw=new Uint8Array(await readSelected());if(raw.length!==size||raw.length>4194304)throw Error('Selected archive byte count changed.');const bytes=new Uint8Array(raw),archiveDigest=await digest(bytes);if(archivePin&&archivePin!==archiveDigest)throw Error('Independent archive expectation mismatch.');
 const wanted=[...CHAIN_ROLES.map(role=>CHAIN_ORIGINAL_PATHS[role]),'validation.json','HANDOFF.txt'],limits=[1048576,65536,1048576,65536,1048576,65536,16384],entries=[],view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=0;
 while(offset+4<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
  if(entries.length>=7||offset+30>bytes.length)throw Error('Unsupported archive entry count or header.');
  const count=view.getUint32(offset+22,true),length=view.getUint16(offset+26,true),start=offset+30+length;
  if(count!==view.getUint32(offset+18,true)||count<1||count>limits[entries.length]||length<1||length>128||view.getUint16(offset+28,true)!==0||start+count>bytes.length)throw Error('Unsupported stored entry bounds.');
  const name=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(offset+30,start));if(name!==wanted[entries.length])throw Error('Unsupported fixed archive layout.');
  entries.push([name,bytes.subarray(start,start+count)]);offset=start+count;
 }
 if(entries.length!==7)throw Error('Exactly seven fixed archive entries are required.');
 // Exact re-encoding checks all local/central headers, flags, CRCs, sizes, order and EOCD.
 const rebuilt=storedZipBytes(entries);if(rebuilt.length!==bytes.length||rebuilt.some((value,index)=>value!==bytes[index]))throw Error('Unsupported ZIP encoding or complete-byte integrity.');
 // Never decode or trust received receipt/guide. Only actual original entry bytes reach models.
 const files=Object.fromEntries(CHAIN_ROLES.map((role,index)=>{const original=entries[index][1];return [role,{size:original.length,arrayBuffer:async()=>original}];}));
 const receipt=await reproduceConversionChain(files,{confirmedNominal:true,confirmedWGS84:true,expected:pins});
 return {format:RECEIVED_CHAIN_VERSION,exact_archive_sha256:archiveDigest,archive_bytes:bytes.length,archive_files:7,expected_archive_digest_matched:archivePin!=='',original_chain:receipt,scope:RECEIVED_CHAIN_SCOPE};
}
