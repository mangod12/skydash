import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, readdir, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto, createHash } from 'node:crypto';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { SAMPLE_LOG, parseFlightCSV, flightCSVHash, LOG_VERSION } from './flightLog';
let dir, notebook, paired, manifest, noteText, pairText, entry;
const hash = value => createHash('sha256').update(value).digest('hex');
const run = (script,...args) => spawnSync(process.execPath,['scripts/'+script+'.mjs',...args],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',timeout:20000});
const verify=(...args)=>run('verify-notebook-review',...args);
const intake=(...args)=>run('verify-training-manifest',...args);
const success=result=>{expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout);};
const failure=result=>{expect(result.status).toBe(1);expect(result.stdout).toBe('');for(const secret of ['PRIVATE','28.6139','77.209'])expect(result.stderr).not.toContain(secret);};
const saveManifest=async bundles=>writeFile(manifest,JSON.stringify({format:'skydash-training-intake-manifest-v1',bundles}));
beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-training-'));notebook=join(dir,'PRIVATE-notebook.json');paired=join(dir,'PRIVATE-paired.json');manifest=join(dir,'PRIVATE-intake.json');
 const log={filename:'PRIVATE.csv',title:'PRIVATE title',csv_text:SAMPLE_LOG,sha256:await flightCSVHash(SAMPLE_LOG),model_version:LOG_VERSION,samples:parseFlightCSV(SAMPLE_LOG)};
 noteText=await createNotebookSourceBundle(log,[{id:'PRIVATE-first',first_row:3,last_row:5,label:'PRIVATE discussion',notes:'PRIVATE notebook note'},{id:'PRIVATE-single',first_row:4,last_row:4,label:'PRIVATE singleton',notes:''},{id:'PRIVATE-repeat',first_row:3,last_row:5,label:'PRIVATE repeat',notes:''}]);
 pairText=await createPairedReviewBundle({log,review:{title:log.title,notes:'PRIVATE analyst'},debrief:{markers:[],notes:'PRIVATE instructor'},envelope:null},{baseline:{...log},notes:'PRIVATE comparison',alignment:null});
 await writeFile(notebook,noteText);await writeFile(paired,pairText);entry={kind:'notebook',path:'PRIVATE-notebook.json',sha256:hash(noteText)};await saveManifest([entry,{kind:'paired',path:'PRIVATE-paired.json',sha256:hash(pairText)}]);
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('validates exact notebook digest and independently recomputes overlapping and singleton copy evidence without private text or sums',async()=>{
 const files=await readdir(dir),result=verify(notebook,'--expect-sha256',hash(noteText).toUpperCase()),data=success(result);expect(data.exact_bundle_sha256).toBe(hash(noteText));expect(data.expected_bundle_digest_matched).toBe(true);expect(data.saved_copy_count).toBe(3);expect(data.copies.map(c=>[c.ordinal,c.first_row,c.last_row,c.samples])).toEqual([[1,3,5,3],[2,4,4,1],[3,3,5,3]]);expect(data.copies[0].intervals_over_5s).toBe(1);expect(data.copies[1].intervals_over_5s).toBe(0);expect(data.copies[0].channels.altitude_m).toEqual({known:2,missing:1});expect(data.copies[1].channels.altitude_m).toEqual({known:0,missing:1});expect(data).not.toHaveProperty('total_samples');for(const secret of ['PRIVATE','28.6139','77.209'])expect(result.stdout).not.toContain(secret);expect(await readdir(dir)).toEqual(files);expect(await readFile(notebook,'utf8')).toBe(noteText);
});
it('binds exact bundle bytes separately from source bytes and accepts a missing expected digest only as unchecked',async()=>{
 const original=success(verify(notebook));expect(original.expected_bundle_digest_matched).toBe(false);await writeFile(notebook,noteText+'\n');failure(verify(notebook,'--expect-sha256',hash(noteText)));const changed=success(verify(notebook));expect(changed.exact_bundle_sha256).not.toBe(original.exact_bundle_sha256);expect(changed.source.sha256).toBe(original.source.sha256);expect(changed.copies).toEqual(original.copies);
});
it.each([0,1,2,3,4,5,6,7])('rejects notebook invalid case %s without a receipt or private payload',async caseIndex=>{
 const raw=JSON.parse(noteText),cases=['PRIVATE malformed',Buffer.from([0xff]),'x'.repeat(2*1024*1024+1),JSON.stringify({...raw,replay_model:'future'}),JSON.stringify({...raw,source:{...raw.source,csv_text:raw.source.csv_text+'\n'}}),JSON.stringify({...raw,notebook:{...raw.notebook,source_sha256:'b'.repeat(64)}}),JSON.stringify({...raw,notebook:{...raw.notebook,windows:[{...raw.notebook.windows[0],last_row:99999}]}}),JSON.stringify({...raw,notebook:{...raw.notebook,windows:[]}})];await writeFile(notebook,cases[caseIndex]);failure(verify(notebook));
});
it('validates mixed kinds in manifest order and indexes reused CSV evidence across notebook and both paired source roles without private paths',async()=>{
 const before=await readdir(dir),result=intake(manifest),data=success(result);expect(data.exact_manifest_sha256).toBe(hash(await readFile(manifest)));expect(data.receipts.map(r=>[r.ordinal,r.kind])).toEqual([[1,'notebook'],[2,'paired']]);expect(data.receipts[0].receipt.saved_copy_count).toBe(3);expect(data.repeated_sources).toHaveLength(1);expect(data.repeated_sources[0].references).toEqual([{ordinal:1,role:'source'},{ordinal:2,role:'primary'},{ordinal:2,role:'baseline'}]);expect(data.repeated_artifacts).toEqual([]);for(const secret of ['PRIVATE','28.6139','77.209'])expect(result.stdout).not.toContain(secret);expect(await readdir(dir)).toEqual(before);
});
it('distinguishes exact repeated artifacts from source reuse and retains every explicitly listed ordinal',async()=>{
 await writeFile(join(dir,'copy.json'),noteText);await saveManifest([entry,{...entry,path:'copy.json'}]);const data=success(intake(manifest));expect(data.repeated_artifacts).toEqual([{sha256:hash(noteText),ordinals:[1,2]}]);expect(data.repeated_sources[0].references).toEqual([{ordinal:1,role:'source'},{ordinal:2,role:'source'}]);
});
it('requires explicit supported kind matching actual artifact and digest, rejects unknown schema and never issues partial results',async()=>{
 for(const bad of [{...entry,kind:'case'},{path:entry.path,sha256:entry.sha256},{...entry,kind:'paired'},{...entry,sha256:'b'.repeat(64)},{...entry,extra:'PRIVATE'}]){await saveManifest([{kind:'paired',path:'PRIVATE-paired.json',sha256:hash(pairText)},bad]);failure(intake(manifest));}
 await saveManifest([{kind:'notebook',path:'PRIVATE-paired.json',sha256:hash(pairText)}]);failure(intake(manifest));await saveManifest([]);failure(intake(manifest));await saveManifest(Array.from({length:21},()=>entry));failure(intake(manifest));await writeFile(manifest,'x'.repeat(65537));failure(intake(manifest));
});
it('contains canonical paths, rejects duplicate aliases/traversal/absolute/outside symlinks, directories and manifest itself',async()=>{
 await mkdir(join(dir,'nested'));await symlink(notebook,join(dir,'alias.json'));await symlink(tmpdir(),join(dir,'outside'));
 for(const path of ['../PRIVATE-notebook.json',notebook,'nested/../PRIVATE-notebook.json','./PRIVATE-notebook.json','nested//file.json','outside/file.json','nested', 'PRIVATE-intake.json','nested\\file.json']){await saveManifest([{...entry,path}]);failure(intake(manifest));}
 await saveManifest([entry,{...entry,path:'alias.json'}]);failure(intake(manifest));await mkdir(join(dir,'nested2'));await writeFile(join(dir,'nested2','valid.json'),noteText);await saveManifest([{...entry,path:'nested2/valid.json'}]);expect(success(intake(manifest)).bundle_count).toBe(1);
});
it('applies kind-specific and total package byte limits before emitting any receipt',async()=>{
 await writeFile(notebook,'x'.repeat(2*1024*1024+1));failure(intake(manifest));await writeFile(notebook,noteText);
 const entries=[];for(let i=0;i<6;i++){const path='large'+i+'.json',bytes=' '.repeat(4*1024*1024);await writeFile(join(dir,path),bytes);entries.push({kind:'paired',path,sha256:hash(bytes)});}await saveManifest(entries);failure(intake(manifest));
});
it('offers help and rejects missing/extra/unknown/directory inputs and duplicated expected-digest flags',()=>{
 expect(verify('--help').status).toBe(0);expect(intake('--help').status).toBe(0);for(const args of [[],[notebook,'--unknown','x'],[notebook,'--expect-sha256','abc'],[notebook,'--expect-sha256',hash(noteText),'--expect-sha256',hash(noteText)],[dir],[join(dir,'missing')]])failure(verify(...args));failure(intake());failure(intake(manifest,'extra'));failure(intake(dir));
});
