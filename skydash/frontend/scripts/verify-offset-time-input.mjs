#!/usr/bin/env node
// Reproduce with this checkout only, never executable content from selected inputs.
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function input(filename,limit){
 const target=resolve(filename),info=await stat(target);
 if(!info.isFile()||info.size>limit)throw new Error('Input must be a bounded regular file.');
 const bytes=await readFile(target);if(bytes.length>limit)throw new Error('Input exceeds byte limit.');
 return {bytes,text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function validator(){
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/offline/offsetTimeReproduction.js'),write:false,minify:false,sourcemap:false}});
 const chunks=output.output.filter(item=>item.type==='chunk');
 if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw new Error('Expected one local timestamp reproduction module.');
 return import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));
}
export async function verifyOffsetTimeInput(originalPath,recipePath,preparedPath,{confirmedNominal=false}={}){
 if(confirmedNominal!==true)throw new Error('Fresh explicit nominal timestamp interpretation confirmation is required.');
 const original=await input(originalPath,1048576),recipe=await input(recipePath,65536),prepared=await input(preparedPath,1048576),api=await validator();
 const receipt=await api.reproduceOffsetTimeInput(original.text,recipe.text,prepared.bytes,{confirmedNominal});
 if(receipt.exact_original_sha256!==original.sha256||receipt.exact_recipe_sha256!==recipe.sha256||receipt.exact_prepared_sha256!==prepared.sha256)throw new Error('Exact raw-file byte hash check failed.');
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length===1&&['--help','-h'].includes(args[0]))console.log('Usage: node scripts/verify-offset-time-input.mjs ORIGINAL.csv TIMESTAMP-RECIPE.json INTERMEDIATE.csv --confirm-nominal\nRead-only exact reproduction using this checkout. Freshly confirm the chosen column represents explicit-offset timestamps and nominal UTC calendar rebasing is intended, not leap-second-aware physical elapsed time or verified clock accuracy. Original/intermediate 1MiB each, recipe 64KiB; strict UTF-8 regular files. All regenerated intermediate bytes must match. No writes, repair, private values, source dates or filenames printed; hashes and shape remain sensitive. This is not an independent expected-digest/authenticity check or integration with existing numeric lineage/portable cases. Keep originals and both conversion stages separately.');
 else if(args.length!==4||args[3]!=='--confirm-nominal'||args.slice(0,3).some(arg=>arg.startsWith('-'))){console.error('Expected original CSV, timestamp recipe JSON, intermediate CSV and fresh --confirm-nominal. Use --help.');process.exitCode=1;}
 else verifyOffsetTimeInput(args[0],args[1],args[2],{confirmedNominal:true}).then(receipt=>console.log(JSON.stringify(receipt,null,2))).catch(()=>{console.error('Timestamp preparation reproduction failed. No receipt or output files written. Check bounded regular UTF-8 files, exact supported recipe/profile, fresh nominal-time confirmation and exact original/intermediate bytes. No repair or partial result accepted. Private inputs are not echoed.');process.exitCode=1;});
}
