#!/usr/bin/env node
// Complete private print from the separate discussion ZIP, never from received reports.
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
import {readBoundedPrivateOriginal} from './report-private-debrief.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const names={expectedArchiveSha256:'archive',expectedSourceSha256:'source',expectedChecklistSha256:'checklist',expectedInstructorSha256:'instructor'};
export async function reportPrivateDiscussionArchive(filename,{includePrivateReview=false,...options}={}){
 if(includePrivateReview!==true||Object.keys(options).some(key=>!Object.hasOwn(names,key)||typeof options[key]!=='string'||!/^[a-fA-F0-9]{64}$/.test(options[key])))throw Error('Explicit private acknowledgement and supported expectations required.');
 const bytes=await readBoundedPrivateOriginal(filename,2*1024*1024);
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/utils/checkDiscussionOriginalsArchive.js'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected isolated local validation module.');const model=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));
 return (await model.privateDiscussionArchivePacket({size:bytes.length,arrayBuffer:async()=>bytes},{includePrivateReview:true,expectedArchiveSha256:options.expectedArchiveSha256??'',expected:Object.fromEntries(Object.entries(options).filter(([key])=>key!=='expectedArchiveSha256').map(([key,value])=>[names[key],value]))})).html;
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/report-private-discussion-archive.mjs ORIGINAL.zip --include-private-review [--expect-archive-sha256 HEX] [--expect-source-sha256 HEX] [--expect-checklist-sha256 HEX] [--expect-instructor-sha256 HEX]\nSensitive complete checklist and every included instructor field/context coordinates/readings, not privacy-limited verification. Required private-output acknowledgement, strict canonical no-symlink regular discussion ZIP2MiB, exact stored layout/current models/all originals checked. Optional independent raw archive/original pins. Static escaped HTML2MiB bound, no received report execution, extraction, writes, network, sharing, restoration or training outcome claim. Save only by explicit redirection, inspect print preview and check exit success; redirection may leave an empty file on failure.');return;}
 if(!args[0]||args[0].startsWith('-'))throw Error('Original required.');const options={},seen=new Set(),flags={'--expect-archive-sha256':'expectedArchiveSha256','--expect-source-sha256':'expectedSourceSha256','--expect-checklist-sha256':'expectedChecklistSha256','--expect-instructor-sha256':'expectedInstructorSha256'};
 for(let index=1;index<args.length;index++){const flag=args[index];if(seen.has(flag))throw Error('Repeated flag.');seen.add(flag);if(flag==='--include-private-review')options.includePrivateReview=true;else if(Object.hasOwn(flags,flag)&&/^[a-fA-F0-9]{64}$/.test(args[index+1]??''))options[flags[flag]]=args[++index];else throw Error('Unsupported option.');}console.log(await reportPrivateDiscussionArchive(args[0],options));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Private discussion ZIP report refused. No HTML issued. Check explicit private acknowledgement, canonical bounded regular original, supported stored layout/current original models and independent raw expectations. Private paths/content not echoed. No writes, extraction, network or sharing. Check exit status; redirection may leave an empty file.');process.exitCode=1;});
