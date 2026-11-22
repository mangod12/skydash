import {rebaseOffsetTimeCSV} from './offsetTimeInput';
import {offsetTimeRecipe} from './offsetTimeReproduction';
import {convertMappedCSV,MAPPING_FIELDS} from '../utils/csvColumnMapping';
import {exportMappingRecipe} from '../utils/mappingRecipe';
import {CHAIN_ROLES} from './conversionChain';
import {CHAIN_ORIGINAL_PATHS,CHAIN_ORIGINALS_GUIDE,prepareConversionChainHandoff} from './conversionChainHandoff';
import {checkReceivedConversionChain} from './receivedConversionChain';
import {storedZipBytes} from '../utils/storedZip';
const encode=text=>new TextEncoder().encode(text);
const file=bytes=>{const owned=typeof bytes==='string'?encode(bytes):new Uint8Array(bytes);return {size:owned.byteLength,arrayBuffer:async()=>owned.slice().buffer};};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
const statements={confirmedNominal:true,confirmedWGS84:true};
export const SYNTHETIC_CHAIN_GUIDE=`SKYDASH / FIXED FABRICATED CONVERSION-CHAIN PRACTICE

These three unsigned, unencrypted ZIPs are fixed fabricated exercises, not recordings, people, aircraft, OEM compatibility, training completion or operational instructions. No input files, active work, account or device storage were read. No files were opened, extracted, uploaded or shared. Save deliberately, then manually select one saved ZIP in the separate received conversion-chain checker.

MATCH-A and MATCH-B each contain five complete originals whose two stages reproduce exactly through the same intermediate. They have different fixed fabricated source timestamps. Matching coherent chains do not establish authenticity or distinguish a trustworthy recording from a coherent rewrite. These are two fabricated variations, not independent flights. BAD-FINAL retains MATCH-A's five original roles and copied receipt/guide, but adds a newline to the final numeric CSV. Its ZIP is structurally complete with valid CRCs; the exact numeric relation must refuse. A copied success receipt cannot make those bytes agree. Every exercise uses seven fixed standard paths, not a training-package or discussion ZIP.

Inspect originals yourself with trusted software before supplying fresh interpretation statements in a separate check. In both matching examples, example_clock contains explicit-offset fabricated timestamps: 2000-01-01T00:00:00Z, 00:00:04Z and 00:00:12Z for A; the corresponding 2000-01-02 timestamps for B. The timestamp recipe chooses the first column and replaces only that column with nominal elapsed seconds 0,4,12. Nominal UTC arithmetic assumes 86400-second days, not measured physical elapsed time. The 8-second source interval is retained without interpolation. Latitude and longitude are fixed fabricated WGS84 decimal-degree exercise coordinates, not observed positions. Numeric mapping chooses the first three columns, seconds with zero origin; the extra exercise_note column remains in the intermediate but is excluded from numeric output. No units, source meanings or physical correctness are inferred.

The generator checks its own known fixed inputs. That does not supply a recipient's fresh statements, authorize replacement of work or establish any real source meaning. Leave independent expectation fields blank for this exercise unless you deliberately obtain an expectation separately through a trusted route. Included/generated hashes are reproducibility fingerprints, not independent authentication, identity or custody. Received receipt/guide content is inert, not evidence or code. No automatic selection, consent, extraction, import or replay opening occurs.

The separate browser checker and trusted-checkout verify-received-conversion-chain CLI can freshly check one explicit ZIP with their own fresh statements. The CLI emits metadata only. Protect and preserve real originals, human records, reviews and workspace work separately. These examples are not workspace backups, grades, certification, readiness or flight-clearance evidence. No storage, network, backend changes or aircraft commands.
`;
async function fixedChain(day){
 const original='example_clock,example_latitude,example_longitude,exercise_note\n'+[0,4,12].map((seconds,index)=>`2000-01-${day}T00:00:${String(seconds).padStart(2,'0')}Z,${28+index/10},${77+index/10},FABRICATED ROW ${index+1}`).join('\n')+'\n';
 const prepared=await rebaseOffsetTimeCSV(original,0);
 const mapping={columns:Object.fromEntries(MAPPING_FIELDS.map((field,index)=>[field.key,index<3?index:null])),timeUnit:'s',timeOrigin:'zero',altitudeUnit:'m',speedUnit:'m/s',coordinateReference:'WGS84-decimal-degrees'};
 const numeric=await convertMappedCSV(prepared.csv_text,'fixed-fabricated-example.csv',mapping);
 return {original,timestamp_recipe:offsetTimeRecipe(prepared),intermediate:prepared.csv_text,mapping_recipe:exportMappingRecipe(prepared.headers,mapping,'FABRICATED PRACTICE ONLY'),converted:numeric.csv_text};
}
export async function syntheticConversionChainStarter(...args){
 if(args.length)throw Error('Fixed fabricated starter accepts no inputs.');
 const archives=[];let first;
 for(const [day,key] of [['01','match-a'],['02','match-b']]){
  const originals=await fixedChain(day),prepared=await prepareConversionChainHandoff(Object.fromEntries(CHAIN_ROLES.map(role=>[role,file(originals[role])])),{...statements,includeSensitiveOriginals:true});
  const checked=await checkReceivedConversionChain(file(prepared.bytes),statements);
  if(!checked.original_chain.shared_intermediate_exact_bytes)throw Error('Fixed matching exercise did not match.');
  archives.push({key,filename:`skydash-fabricated-chain-${key}.zip`,bytes:prepared.bytes,fileCount:prepared.fileCount,archiveDigest:prepared.archiveDigest,expectedOutcome:'match'});
  if(!first)first={originals,receipt:prepared.receipt};
 }
 const changed={...first.originals,converted:first.originals.converted+'\n'};
 const bytes=storedZipBytes([...CHAIN_ROLES.map(role=>[CHAIN_ORIGINAL_PATHS[role],changed[role]]),['validation.json',JSON.stringify(first.receipt,null,2)+'\n'],['HANDOFF.txt',CHAIN_ORIGINALS_GUIDE]]);
 let refused=false;try{await checkReceivedConversionChain(file(bytes),statements);}catch{refused=true;}
 if(!refused)throw Error('Fixed nonmatching exercise unexpectedly matched.');
 archives.push({key:'bad-final',filename:'skydash-fabricated-chain-bad-final.zip',bytes,fileCount:7,archiveDigest:await digest(bytes),expectedOutcome:'refuse'});
 return {format:'skydash-fabricated-conversion-chain-starter-v1',synthetic_only:true,archives,guide:SYNTHETIC_CHAIN_GUIDE};
}
