#!/usr/bin/env node
import {lstat,realpath,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),hash=value=>createHash('sha256').update(value).digest('hex');
export async function prepareDiscussionExampleFiles(){
 const output=await build({configFile:false,root,logLevel:'silent',build:{ssr:resolve(root,'src/utils/syntheticDiscussionStarter.js'),write:false,minify:false,sourcemap:false}}),chunks=output.output.filter(item=>item.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Isolated fixed synthetic generator required.');
 const model=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64')),value=await model.syntheticDiscussionStarter();
 const filenames=['skydash-synthetic-discussion-left.zip','skydash-synthetic-discussion-right.zip','skydash-synthetic-discussion-no-instructor.zip'];if(value.archives.length!==3||value.intake.checked_archives!==3||value.intake.refused_archives!==0)throw Error('All fixed originals must freshly check.');
 const files=value.archives.map((archive,index)=>{if(archive.filename!==filenames[index]||!(archive.bytes instanceof Uint8Array)||archive.bytes.length>2*1024*1024)throw Error('Fixed bounded synthetic archives required.');return {name:filenames[index],bytes:Buffer.from(archive.bytes)};});
 const intake=Buffer.from(JSON.stringify(value.intake,null,2)+'\n'),guide=Buffer.from(value.guide);if(intake.length>64*1024||guide.length>64*1024)throw Error('Bounded generated guide and intake required.');files.push({name:'synthetic-discussion-intake.json',bytes:intake},{name:'SKYDASH-SYNTHETIC-DISCUSSION-GUIDE.txt',bytes:guide});
 const receipt={format:'skydash-synthetic-discussion-example-v1',synthetic_only:true,files:files.map(file=>({filename:file.name,bytes:file.bytes.length,sha256:hash(file.bytes)})),scope:'Fixed fabricated source/reviews only, not real people, timestamps, recordings, OEM compatibility or completed training. Three standard discussion ZIPs reuse one synthetic CSV, not three independent flights;5/5/4entries with explicit instructor absence on third. Current complete-original packer/intake checks freshly run before writing. Generated hashes/JSON/guide are reproducibility output, never independent expectations, authenticated authorship/history/custody or readiness. New folder/files only; no selected private input, workspace/account/library reads, overwrite, extraction, automatic opening/import, network or sharing. Preserve real originals and unsaved work separately. Follow the guide using deliberate saved-file selection and each existing privacy/replacement confirmation.'};
 return {files,receipt};
}
export async function createDiscussionExample(outputDir){
 if(typeof outputDir!=='string'||!outputDir.trim()||outputDir.startsWith('-'))throw Error('One explicit new output folder required.');
 const target=resolve(outputDir),parent=dirname(target);if(target===parent||await realpath(parent)!==parent||(await lstat(parent)).isSymbolicLink()||!(await lstat(parent)).isDirectory())throw Error('Existing canonical no-symlink parent required.');
 const {files,receipt}=await prepareDiscussionExampleFiles();
 // No recursive parents, existing destination reuse, overwrite or implicit opening.
 // A failed write can leave a partial new folder, but never a success receipt.
 await mkdir(target,{mode:0o700});for(const file of files)await writeFile(join(target,file.name),file.bytes,{flag:'wx',mode:0o600});
 return receipt;
}

async function main(args){if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/create-discussion-example.mjs --output-dir NEW-FOLDER\nCreates one new folder of five fixed files: three freshly checked standard5/5/4-entry SYNTHETIC discussion ZIPs, intake JSON and manual-route guide. No real input files, recordings, workspace or accounts are read. Existing canonical no-symlink parent required; parents are not created. Existing destinations/files/symlinks are never reused or overwritten;0700 folder/0600 files where supported. Check exit status: a failed write can leave a partial new folder, never a success receipt. Generated hashes are not independent expectations/authentication; the examples are not real flights, completed training, grades or readiness. No extraction, automatic opening/import, network or sharing.');return;}if(args.length!==2||args[0]!=='--output-dir')throw Error('One supported output argument required.');console.log(JSON.stringify(await createDiscussionExample(args[1]),null,2));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Synthetic discussion example creation refused. No success receipt. Check one new destination and an existing canonical parent in a trusted installed checkout. Nothing existing overwritten or opened; a failed write can leave a partial new folder. No private paths/content echoed, extraction, network or sharing.');process.exitCode=1;});
