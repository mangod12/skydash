#!/usr/bin/env node
// Only installed checkout code is executable. Every received ZIP entry is data.
import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),limit=4194304;
async function validator(){const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/offline/receivedConversionChain.js'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Expected one self-contained trusted checkout validator.');return import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));}
export async function verifyReceivedConversionChain(filename,{confirmedNominal=false,confirmedWGS84=false,expectedArchiveSha256='',expected={}}={}){
 if(confirmedNominal!==true||confirmedWGS84!==true)throw Error('Both fresh interpretation statements are required before any path access.');
 if(typeof filename!=='string'||!filename||!expected||typeof expected!=='object'||Array.isArray(expected))throw Error('One explicit archive path and separate options are required.');
 const target=resolve(filename),pins=Object.fromEntries(Object.entries(expected)),archivePin=expectedArchiveSha256,info=await lstat(target);if(!info.isFile()||info.size<22||info.size>limit)throw Error('Choose one bounded regular archive, not a symbolic link.');
 const size=info.size,file={size,arrayBuffer:async()=>{const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const current=await handle.stat();if(!current.isFile()||current.size!==size||current.size>limit)throw Error('Selected archive metadata changed.');const bytes=Buffer.alloc(limit+1);let count=0;while(count<bytes.length){const read=await handle.read(bytes,count,bytes.length-count,count);if(!read.bytesRead)break;count+=read.bytesRead;}if(count!==size||count>limit)throw Error('Selected archive bytes changed.');return bytes.subarray(0,count);}finally{await handle.close();}}};
 const api=await validator();return api.checkReceivedConversionChain(file,{confirmedNominal:true,confirmedWGS84:true,expectedArchiveSha256:archivePin,expected:pins});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length===1&&['--help','-h'].includes(args[0]))console.log('Usage: node scripts/verify-received-conversion-chain.mjs CHAIN.zip --confirm-nominal --confirm-wgs84\nRead-only fresh reproduction of five originals in one fixed seven-entry stored chain ZIP,4MiB maximum, through this installed checkout. Both fresh caller interpretation statements are mandatory, never supplied by the ZIP. Symbolic-link paths rejected; bounded regular-file read only. No extraction, output writes, replay/import, storage, network, upload or sharing. Received receipt/guide bytes are never parsed, rendered, executed or trusted. Metadata hashes/shape remain sensitive. This positional CLI supplies no independent archive or original expectations; all six statuses report absent. Exported API/browser accept separate optional expectations. Matching bytes do not establish source authenticity, clock/coordinate accuracy, identity, custody, OEM compatibility, completion, grades or readiness. Nominal UTC calendar arithmetic is not leap-second-aware physical elapsed time.');
 else if(args.length!==3||!args[0]||args[0].startsWith('-')||args[1]!=='--confirm-nominal'||args[2]!=='--confirm-wgs84'){console.error('Expected one archive path followed by fresh --confirm-nominal --confirm-wgs84. Use --help.');process.exitCode=1;}
 else verifyReceivedConversionChain(args[0],{confirmedNominal:true,confirmedWGS84:true}).then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{console.error('Received conversion-chain ZIP refused. Check the exact bounded seven-entry stored layout, complete byte integrity, five supported original models/recipes, same intermediate and final bytes, and both fresh interpretation statements. No partial receipt, extraction or output files. Private inputs and filenames are not echoed.');process.exitCode=1;});
}
