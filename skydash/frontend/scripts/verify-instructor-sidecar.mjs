#!/usr/bin/env node
// Read-only source/sidecar check, built from this checkout, never from inputs.
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function input(filename,limit,expected){
 if(expected!==null&&!/^[a-fA-F0-9]{64}$/.test(expected))throw Error('Invalid independent digest.');
 const path=resolve(filename),info=await stat(path);if(!info.isFile()||info.size>limit)throw Error('Expected bounded regular input.');
 const bytes=await readFile(path);if(bytes.length>limit)throw Error('Input exceeds limit.');
 const sha256=createHash('sha256').update(bytes).digest('hex');if(expected!==null&&sha256!==expected.toLowerCase())throw Error('Independent digest mismatch.');
 return {text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256};
}
export async function verifyInstructorSidecar(sourcePath,sidecarPath,{expectedSourceSha256=null,expectedSidecarSha256=null}={}){
 const source=await input(sourcePath,1024*1024,expectedSourceSha256),sidecar=await input(sidecarPath,256*1024,expectedSidecarSha256);
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'scripts/instructor-sidecar-models.mjs'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');
 if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected one local validation module.');
 const model=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));
 const log={sha256:source.sha256,model_version:model.LOG_VERSION,samples:model.parseFlightCSV(source.text)},review=model.readDebriefSidecar(sidecar.text,log);
 const counts=Object.fromEntries(model.MARKER_KINDS.map(kind=>[kind,review.markers.filter(marker=>marker.kind===kind).length]));
 return {format:'skydash-instructor-sidecar-validation-receipt-v1',exact_source_sha256:source.sha256,exact_sidecar_sha256:sidecar.sha256,expected_source_digest_matched:expectedSourceSha256!==null,expected_sidecar_digest_matched:expectedSidecarSha256!==null,replay_model:model.LOG_VERSION,sidecar_format:review.format,source:{samples:log.samples.length,start_s:0,end_s:log.samples.at(-1).time_s},saved_markers:review.markers.length,marker_kinds:counts,
 scope:'Actual checkout CSV/model/sidecar/fingerprint/unique-ID/time/kind/text/discussion/summary bounds validated against the complete original source. Independent complete-file expectations are optional and separate for source and sidecar; obtain through a trusted separate route. A source fingerprint does not protect private review words or prove authorship. Counts are annotation inventory, not flights, assessed skills, discussion completion or readiness. No private paths, filenames, marker IDs/text, summary, coordinates or individual readings printed. Hashes/counts/times can still identify sensitive work. Editable receipt, not authenticated authorship, source truth, signature, custody or training certification. First-to-last span is not continuous observation. Sidecar contains no CSV; preserve both originals. No source repair, report, files written, storage, network, upload, sharing or aircraft commands.'};
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/verify-instructor-sidecar.mjs SOURCE.csv SIDECAR.json [--expect-source-sha256 HEX] [--expect-sidecar-sha256 HEX]\nRead-only actual app CSV/instructor validation against exact source bytes. Strict UTF-8 regular files, source1MiB and sidecar256KiB. Separate optional independent complete-file pins checked before parsing. Private-text-free JSON receipt only. No writes, storage, network, authenticity or readiness claim.');return;}
 if(args.length<2||args.length%2!==0||args.slice(0,2).some(arg=>arg.startsWith('-')))throw Error('Invalid arguments.');const options={};
 for(let i=2;i<args.length;i+=2){const key=args[i]==='--expect-source-sha256'?'expectedSourceSha256':args[i]==='--expect-sidecar-sha256'?'expectedSidecarSha256':null;if(!key||key in options||!/^[a-fA-F0-9]{64}$/.test(args[i+1]??''))throw Error('Invalid expectation.');options[key]=args[i+1];}
 console.log(JSON.stringify(await verifyInstructorSidecar(args[0],args[1],options),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Instructor sidecar validation failed. No receipt or files written. Check bounded regular UTF-8 originals, independent complete-file expectations, exact matching CSV fingerprint and supported model/marker/summary bounds. Private inputs are not echoed.');process.exitCode=1;});
