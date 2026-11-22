#!/usr/bin/env node
// Execute only this installed checkout's validators, never selected recipe/file code.
import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),roles=['original','timestamp_recipe','intermediate','mapping_recipe','converted'];
async function validator(){const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/offline/conversionChain.js'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected one self-contained local conversion-chain validator.');return import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));}
async function selected(filename,limit){
 const target=resolve(filename),info=await lstat(target);if(!info.isFile()||info.size<1||info.size>limit)throw Error('Choose bounded nonempty regular files, not symbolic links.');
 return {size:info.size,arrayBuffer:async()=>{const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const current=await handle.stat();if(!current.isFile()||current.size!==info.size||current.size>limit)throw Error('Selected file metadata changed.');const bytes=Buffer.alloc(limit+1);let count=0;while(count<bytes.length){const read=await handle.read(bytes,count,bytes.length-count,count);if(read.bytesRead===0)break;count+=read.bytesRead;}if(count!==info.size||count>limit)throw Error('Selected file bytes changed.');return bytes.subarray(0,count);}finally{await handle.close();}}};
}
export async function verifyConversionChain(paths,{confirmedNominal=false,confirmedWGS84=false,expected={}}={}){
 if(confirmedNominal!==true||confirmedWGS84!==true)throw Error('Fresh nominal timestamp and WGS84 source statements are both required before file access.');
 if(!Array.isArray(paths)||paths.length!==5||paths.some(path=>typeof path!=='string'||!path))throw Error('Exactly five explicitly selected paths are required.');
 const chosen=paths.slice(),pins=Object.fromEntries(roles.map(role=>[role,expected?.[role]??''])),files={};for(let index=0;index<roles.length;index++){const role=roles[index];files[role]=await selected(chosen[index],role.endsWith('_recipe')?65536:1048576);}
 const api=await validator();return api.reproduceConversionChain(files,{confirmedNominal,confirmedWGS84,expected:pins});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length===1&&['--help','-h'].includes(args[0]))console.log('Usage: node scripts/verify-conversion-chain.mjs ORIGINAL.csv TIMESTAMP-RECIPE.json INTERMEDIATE.csv NUMERIC-RECIPE.json FINAL.csv --confirm-nominal --confirm-wgs84\nRead-only exact reproduction of both stages through the same intermediate, using this installed checkout. Both fresh caller statements are required, not supplied by recipes. CSV1MiB each, recipes64KiB each; bounded nonempty regular UTF-8 files, symbolic-link inputs rejected. No repair, output writes, private values, paths or filenames printed; raw hashes and shape remain sensitive. CLI supplies no independent expected hashes; receipt marks all expectations absent. The exported API and browser can accept separate expected raw-file pins. Exact relations do not authenticate source clocks, units/datum, identity, custody, OEM compatibility, grades or readiness; nominal UTC arithmetic is not leap-second-aware physical time. Keep all five files and both human records separately; existing numeric lineage/cases remain unchanged.');
 else if(args.length!==7||args[5]!=='--confirm-nominal'||args[6]!=='--confirm-wgs84'||args.slice(0,5).some(arg=>arg.startsWith('-'))){console.error('Expected five original paths followed by fresh --confirm-nominal --confirm-wgs84. Use --help.');process.exitCode=1;}
 else verifyConversionChain(args.slice(0,5),{confirmedNominal:true,confirmedWGS84:true}).then(receipt=>console.log(JSON.stringify(receipt,null,2))).catch(()=>{console.error('Two-stage conversion relation failed. No receipt or output files written. Check five bounded regular UTF-8 originals, exact supported recipes/headers/models, both fresh caller statements and exact intermediate/final bytes. Private inputs and filenames are not echoed.');process.exitCode=1;});
}
