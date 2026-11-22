#!/usr/bin/env node
// Read-only serial discussion intake. A refused row is not a verified original.
import {lstat,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
import {readBoundedPrivateOriginal} from './report-private-debrief.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),roles=['source','checklist','instructor'],pin=value=>typeof value==='string'&&(value===''||/^[a-fA-F0-9]{64}$/.test(value));
function entry(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['filename','expectedArchiveSha256','expected'].includes(key))||typeof value.filename!=='string'||!value.filename.length)throw Error('Supported input paths and independent expectations required.');
 const{filename,expectedArchiveSha256='',expected={}}=value;if(!pin(expectedArchiveSha256)||!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).some(role=>!roles.includes(role)||!pin(expected[role])))throw Error('Supported independent expectations required.');return{filename,expectedArchiveSha256,expected:{...expected}};
}
export async function checkDiscussionIntakeFiles(entries){
 if(!Array.isArray(entries)||entries.length<1||entries.length>10)throw Error('One to ten input files required.');
 const selected=Array.from(entries,entry),inputs=[];
 for(const value of selected){
  const path=resolve(value.filename);let size=0;
  try{const info=await lstat(path);if(info.isFile()&&!info.isSymbolicLink()&&await realpath(path)===path)size=info.size;}catch{/* Missing/noncanonical inputs remain generic refused positions. */}
  inputs.push({file:{size,arrayBuffer:async()=>readBoundedPrivateOriginal(path,2*1024*1024)},expectedArchiveSha256:value.expectedArchiveSha256,expected:value.expected});
 }
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/utils/discussionIntake.js'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected isolated local intake model.');
 const model=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));return model.checkDiscussionIntake(inputs);
}
export function parseDiscussionIntakeArguments(args){
 const firstFlag=args.findIndex(value=>value.startsWith('-')),paths=firstFlag===-1?args:args.slice(0,firstFlag),flags=firstFlag===-1?[]:args.slice(firstFlag);if(paths.length<1||paths.length>10||flags.length%2)throw Error('Supported input paths and options required.');
 const entries=paths.map(filename=>({filename,expected:{}})),seen=new Set();
 for(let i=0;i<flags.length;i+=2){const match=/^--expect-input-([1-9]|10)-(archive|source|checklist|instructor)-sha256$/.exec(flags[i]);if(!match||Number(match[1])>entries.length||seen.has(flags[i])||!/^[a-fA-F0-9]{64}$/.test(flags[i+1]??''))throw Error('Supported unique input expectations required.');seen.add(flags[i]);const target=entries[Number(match[1])-1];if(match[2]==='archive')target.expectedArchiveSha256=flags[i+1];else target.expected[match[2]]=flags[i+1];}
 return entries;
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/check-discussion-intake.mjs INPUT1.zip [INPUT2.zip ... INPUT10.zip] [--expect-input-N-archive-sha256 HEX] [--expect-input-N-source-sha256 HEX] [--expect-input-N-checklist-sha256 HEX] [--expect-input-N-instructor-sha256 HEX]\nOne to ten explicit canonical no-symlink regular inputs, including parent paths,20MiB total; each supported complete stored discussion ZIP at most2MiB. N is the one-based selected input position, never chronology or identity. Optional independent archive/raw pins stay separate, generated hashes never populate expectations. Current all-original checks, received receipt/guide inert. Generic individual refusals do not prevent later checks. Privacy-limited sensitive JSON matches the browser intake model, no original words/IDs/filenames/coordinates/readings/private errors. No cross-original status/training totals, extraction, writes, restoration, network or sharing. Exit 0: all checked. Exit 2: valid partial/all-refused JSON. Exit 1: configuration/build failure with no report. Paths precede flags; prefix a leading-dash filename with ./ . Check exit status and refused rows: redirection can leave an empty or partial report. Hash/count/span/fingerprint relations are not authenticated authorship, history, outcomes, readiness or a backup.');return;}
 const entries=parseDiscussionIntakeArguments(args);
 const report=await checkDiscussionIntakeFiles(entries);console.log(JSON.stringify(report,null,2));if(report.refused_archives){console.error('Some selected inputs were refused. JSON preserves every selected position; inspect refused rows. No private diagnostics or originals output.');process.exitCode=2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Discussion intake configuration/build refused. No report issued. Check one-to-ten canonical regular inputs,20MiB total, supported independent expectations and trusted current checkout. Private paths/content not echoed. No writes, extraction, restoration, network or sharing. Check exit status; redirection can leave an empty report.');process.exitCode=1;});
