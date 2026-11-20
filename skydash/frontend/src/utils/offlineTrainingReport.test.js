import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { mkdtemp,readFile,writeFile,readdir,rm,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash,webcrypto } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG,parseFlightCSV,flightCSVHash,LOG_VERSION } from './flightLog';
let dir,manifest,entries,text;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(...args)=>spawnSync(process.execPath,['scripts/report-training-intake.mjs',...args],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',timeout:20000});
const check=(...args)=>run(manifest,...args);
const failure=result=>{expect(result.status).toBe(1);expect(result.stdout).toBe('');for(const secret of ['PRIVATE','28.6139','77.209'])expect(result.stderr).not.toContain(secret);};
const save=async(format='skydash-training-intake-manifest-v2',bundles=entries)=>writeFile(manifest,JSON.stringify({format,bundles}));
beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-intake-report-'));manifest=join(dir,'PRIVATE-manifest.json');
 const log={filename:'PRIVATE.csv',title:'PRIVATE <img src="https://invalid.test/leak">',notes:'PRIVATE',csv_text:SAMPLE_LOG,sha256:await flightCSVHash(SAMPLE_LOG),model_version:LOG_VERSION,samples:parseFlightCSV(SAMPLE_LOG)};
 const review={log,review:{title:log.title,notes:'PRIVATE analyst'},debrief:{markers:[],notes:'PRIVATE discussion'},envelope:null};
 text=await createReviewCase(log,review.review,review.debrief,null);
 const files=[['case',text],['notebook',await createNotebookSourceBundle(log,[{id:'PRIVATE-copy',first_row:3,last_row:5,label:'PRIVATE label',notes:'PRIVATE note'},{id:'PRIVATE-single',first_row:4,last_row:4,label:'PRIVATE',notes:''},{id:'PRIVATE-repeat',first_row:3,last_row:5,label:'PRIVATE',notes:''}])],['paired',await createPairedReviewBundle(review,{baseline:log,notes:'PRIVATE comparison',alignment:null})]];
 entries=[];for(const[kind,bytes]of files){const path='PRIVATE-'+kind+'.json';await writeFile(join(dir,path),bytes);entries.push({kind,path,sha256:hash(bytes)});}await save();
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('validates original mixed files then emits one deterministic private-text-free static report without writes or remote assets',async()=>{
 const files=await readdir(dir),before=await readFile(manifest,'utf8'),r=check();expect(r.status,r.stderr).toBe(0);expect(r.stdout.startsWith('<!doctype html>')).toBe(true);for(const value of ['PRIVATE','28.6139','77.209','invalid.test','<script','<iframe','<img','<a ','onclick=','fetch('])expect(r.stdout).not.toContain(value);
 for(const phrase of ['Bundle 1: case','Bundle 2: notebook','Bundle 3: paired','3 listed bundles','not a flight, student or completion count','No external complete-manifest digest','No authenticity, certification or readiness claim','Every interval is unsampled','Bundle 3 baseline','Bundle 3 primary','Saved-copy evidence','overlap or repeat','No exact complete-artifact hash is repeated'])expect(r.stdout).toContain(phrase);
 expect(r.stdout).toContain('Content-Security-Policy');expect(r.stdout).toContain("default-src 'none'");expect(r.stdout).toContain('form-action');expect(r.stdout).toContain(hash(before));expect(r.stdout).toBe(check().stdout);expect(await readdir(dir)).toEqual(files);expect(await readFile(manifest,'utf8')).toBe(before);
});
it('separates optional external manifest agreement from mandatory per-file agreement including exact raw whitespace',async()=>{
 const pin=hash(await readFile(manifest));let r=check('--expect-sha256',pin.toUpperCase());expect(r.status).toBe(0);expect(r.stdout).toContain('caller-supplied expected complete-manifest digest matched');await writeFile(manifest,(await readFile(manifest,'utf8'))+'\n');failure(check('--expect-sha256',pin));expect(check().status).toBe(0);await writeFile(join(dir,entries[2].path),(await readFile(join(dir,entries[2].path),'utf8'))+'\n');failure(check());
});
it('checks nested original content even with newly matching manifest digests, never rendering a late partial report',async()=>{
 const raw=JSON.parse(await readFile(join(dir,entries[2].path),'utf8'));raw.comparison.baseline.sha256='f'.repeat(64);const invalid=JSON.stringify(raw);await writeFile(join(dir,entries[2].path),invalid);entries[2].sha256=hash(invalid);await save();failure(check());
});
it('does not accept a previously generated success receipt instead of original manifest and artifacts',async()=>{
 await writeFile(manifest,JSON.stringify({format:'skydash-training-intake-receipt-v2',bundle_count:3,receipts:[],scope:'PRIVATE success'}));failure(check());
});
it('retains original v1 semantics, accepts notebook/paired and rejects case kind without explicit v2',async()=>{
 await save('skydash-training-intake-manifest-v1',entries.slice(1));const r=check();expect(r.status).toBe(0);expect(r.stdout).toContain('2 listed bundles');expect(r.stdout).toContain('Manifest version: 1');expect(r.stdout).toContain('Bundle 1: notebook');await save('skydash-training-intake-manifest-v1');failure(check());
});
it('distinguishes repeated exact artifacts from source reuse without deduplicating entries or summing flight evidence',async()=>{
 await writeFile(join(dir,'another-case.json'),text);await save(undefined,[entries[0],{...entries[0],path:'another-case.json'}]);const r=check();expect(r.status).toBe(0);expect(r.stdout).toContain('Bundle 2: case');expect(r.stdout).toContain('Bundle 1; Bundle 2');expect(r.stdout).toContain('not independent flights');expect(r.stdout).not.toContain('No exact complete-artifact hash is repeated');expect(r.stdout).not.toContain('total_samples');
});
it.each(['bad-json','utf8','too-large','traversal','alias','wrong-kind','missing'])('preserves all-or-nothing original intake boundaries for %s',async kind=>{
 if(kind==='bad-json')await writeFile(manifest,'PRIVATE invalid');if(kind==='utf8')await writeFile(manifest,Buffer.from([0xff]));if(kind==='too-large')await writeFile(manifest,'x'.repeat(65537));if(kind==='traversal')await save(undefined,[{...entries[0],path:'../PRIVATE-case.json'}]);if(kind==='alias'){await symlink(join(dir,entries[0].path),join(dir,'alias.json'));await save(undefined,[entries[0],{...entries[0],path:'alias.json'}]);}if(kind==='wrong-kind')await save(undefined,[entries[0],{...entries[1],kind:'paired'}]);if(kind==='missing')await save(undefined,[entries[0],{...entries[2],path:'missing.json'}]);failure(check());
});
it('supports help but rejects missing, directory and malformed/unknown/duplicate option arguments',()=>{
 expect(run('--help').status).toBe(0);for(const args of[[],[dir],[manifest,'extra'],[manifest,'--expect-sha256','bad'],[manifest,'--unknown','f'.repeat(64)],[manifest,'--expect-sha256','f'.repeat(64),'--expect-sha256','f'.repeat(64)]])failure(run(...args));
});
