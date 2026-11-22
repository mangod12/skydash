#!/usr/bin/env node
// Privacy-limited comparison of two complete discussion ZIPs, never a restore/merge.
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
import {readBoundedPrivateOriginal} from './report-private-debrief.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),roles=['archive','source','checklist','instructor'];
const supported=options=>options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(role=>roles.includes(role)&&typeof options[role]==='string'&&/^[a-fA-F0-9]{64}$/.test(options[role]));
export async function compareDiscussionArchives(leftFilename,rightFilename,{left={},right={},...unknown}={}){
 if(Object.keys(unknown).length||!supported(left)||!supported(right))throw Error('Supported separate independent expectations required.');
 const a=await readBoundedPrivateOriginal(leftFilename,2*1024*1024),b=await readBoundedPrivateOriginal(rightFilename,2*1024*1024);
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/utils/checkDiscussionOriginalsArchive.js'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected isolated local comparison model.');const model=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));
 const file=bytes=>({size:bytes.length,arrayBuffer:async()=>bytes}),options=pins=>({expectedArchiveSha256:pins.archive??'',expected:Object.fromEntries(Object.entries(pins).filter(([role])=>role!=='archive'))});
 return model.compareDiscussionArchiveSnapshots(file(a),file(b),{left:options(left),right:options(right)});
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/compare-discussion-archives.mjs LEFT.zip RIGHT.zip [--expect-left-archive-sha256 HEX] [--expect-left-source-sha256 HEX] [--expect-left-checklist-sha256 HEX] [--expect-left-instructor-sha256 HEX] [--expect-right-archive-sha256 HEX] [--expect-right-source-sha256 HEX] [--expect-right-checklist-sha256 HEX] [--expect-right-instructor-sha256 HEX]\nSeparate optional independent raw complete-file pins on each side. Both canonical no-symlink regular ZIPs2MiB each, including parent paths; exact supported stored layout/CRCs/current models/every original checked. Privacy-limited exact-ID aggregates only for equal complete raw CSV bytes; otherwise all association/content/field/side-only counts suppressed. No private words/IDs/paths/coordinates/readings, but hashes/counts/span remain sensitive. No private HTML, extraction, writes, network, merge, transfer, restoration, authenticated revision history, outcome or sharing. Check exit status; shell redirection can leave an empty file on failure.');return;}
 if(args.length<2||args.length%2!==0||args.slice(0,2).some(arg=>arg.startsWith('-')))throw Error('Two originals required.');const options={left:{},right:{}},seen=new Set();
 for(let i=2;i<args.length;i+=2){const match=/^--expect-(left|right)-(archive|source|checklist|instructor)-sha256$/.exec(args[i]);if(!match||seen.has(args[i])||!/^[a-fA-F0-9]{64}$/.test(args[i+1]??''))throw Error('Unsupported expectation.');seen.add(args[i]);options[match[1]][match[2]]=args[i+1];}
 console.log(JSON.stringify(await compareDiscussionArchives(args[0],args[1],options),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Discussion ZIP comparison refused. No result issued. Check both canonical bounded regular originals, supported exact stored layouts/CRCs/current source-bound models and independent per-side expectations. Private paths/content not echoed. No writes, extraction, merge, restoration, network or sharing. Check exit status; redirection may leave an empty file.');process.exitCode=1;});
