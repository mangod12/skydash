#!/usr/bin/env node
// Selected original source and sidecars only; receipts never replace originals.
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function input(filename,limit,expected){
 if(expected!==null&&!/^[a-fA-F0-9]{64}$/.test(expected))throw Error('Invalid independent digest.');
 const path=resolve(filename),info=await stat(path);if(!info.isFile()||info.size>limit)throw Error('Expected bounded regular input.');
 const bytes=await readFile(path);if(bytes.length>limit)throw Error('Input exceeds limit.');const sha256=createHash('sha256').update(bytes).digest('hex');if(expected!==null&&sha256!==expected.toLowerCase())throw Error('Independent digest mismatch.');
 return {text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256};
}
export async function compareInstructorSidecars(sourcePath,leftPath,rightPath,{expectedSourceSha256=null,expectedLeftSha256=null,expectedRightSha256=null}={}){
 const source=await input(sourcePath,1024*1024,expectedSourceSha256),left=await input(leftPath,256*1024,expectedLeftSha256),right=await input(rightPath,256*1024,expectedRightSha256);
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'scripts/instructor-sidecar-models.mjs'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');
 if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected one local validation module.');
 const model=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));

 const log={sha256:source.sha256,model_version:model.LOG_VERSION,samples:model.parseFlightCSV(source.text)},a=model.readDebriefSidecar(left.text,log),b=model.readDebriefSidecar(right.text,log),comparison=model.instructorReplacement(log,a.markers,a.notes,b);
 const changedFields=Object.fromEntries(['time_s','kind','text','discussed'].map(key=>[key,comparison.rows.filter(row=>row.fields.includes(key)).length]));
 return {format:'skydash-instructor-sidecar-comparison-receipt-v1',exact_source_sha256:source.sha256,exact_left_sha256:left.sha256,exact_right_sha256:right.sha256,expected_source_digest_matched:expectedSourceSha256!==null,expected_left_digest_matched:expectedLeftSha256!==null,expected_right_digest_matched:expectedRightSha256!==null,exact_sidecar_bytes_equal:left.sha256===right.sha256,normalized_saved_review_equal:JSON.stringify(a)===JSON.stringify(b),source:{samples:log.samples.length,start_s:0,end_s:log.samples.at(-1).time_s},left_markers:a.markers.length,right_markers:b.markers.length,exact_id_changes:comparison.counts,changed_fields:changedFields,summary_changed:comparison.summaryChanged,
 scope:'Three explicitly selected complete originals revalidated with current app models and bounds. Both sidecars must bind to this exact complete CSV. Left/right are chosen sides, never verified earlier/later chronology. Exact annotation IDs only, never guessed note/time similarity; IDs and authorship remain unverified. Added/removed/changed describe this directional comparison, not authenticated edits or training events. New IDs remain separate even for identical notes/times. Changed-field counts apply only to same-ID changed markers, not added/removed annotations, and may overlap. Text/summary whitespace remains content; JSON formatting/key order and validator timeline ordering may differ without normalized saved-content change. No private paths, filenames, IDs, note text, summary, coordinates or readings printed. Hashes/counts/patterns/times can still identify sensitive work. No per-person/flight/task/completion/grade/readiness totals, patch, merge, transfer, source repair, writes, network, storage, sharing, signature or custody proof. Preserve original source and both sidecars; this editable receipt cannot reopen a review or replace revalidation.'};
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/compare-instructor-sidecars.mjs SOURCE.csv LEFT.json RIGHT.json [--expect-source-sha256 HEX] [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nRead-only original CSV plus two exact-source instructor sidecars. Strict UTF-8 regular source1MiB/sidecars256KiB each. Separate optional independent raw-file pins. Privacy-limited exact-ID change counts, no private text, merge, writes, network or authenticated chronology.');return;}
 if(args.length<3||args.length%2!==1||args.slice(0,3).some(arg=>arg.startsWith('-')))throw Error('Invalid arguments.');const options={};
 for(let i=3;i<args.length;i+=2){const key=args[i]==='--expect-source-sha256'?'expectedSourceSha256':args[i]==='--expect-left-sha256'?'expectedLeftSha256':args[i]==='--expect-right-sha256'?'expectedRightSha256':null;if(!key||key in options||!/^[a-fA-F0-9]{64}$/.test(args[i+1]??''))throw Error('Invalid expectation.');options[key]=args[i+1];}
 console.log(JSON.stringify(await compareInstructorSidecars(args[0],args[1],args[2],options),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Instructor sidecar comparison failed. No comparison or files written. Check all bounded regular UTF-8 originals, independent file expectations, exact shared source fingerprint and supported nested models and annotation bounds. Private inputs are not echoed.');process.exitCode=1;});
