import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { mkdtemp,writeFile,readFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash,webcrypto } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { SAMPLE_LOG,parseFlightCSV,flightCSVHash,LOG_VERSION } from './flightLog';
let dir,left,right,text,log;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(...args)=>spawnSync(process.execPath,['scripts/compare-review-cases.mjs',...args],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',timeout:20000});
const check=(...args)=>run(left,right,...args);
const success=r=>{expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);};
const failure=r=>{expect(r.status).toBe(1);expect(r.stdout).toBe('');expect(r.stderr).not.toContain('PRIVATE');expect(r.stderr).not.toContain('28.6139');};
const modify=async fn=>{const data=JSON.parse(text);await fn(data);await writeFile(right,JSON.stringify(data));};
beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-case-revisions-'));left=join(dir,'PRIVATE-left.json');right=join(dir,'PRIVATE-right.json');log={filename:'PRIVATE.csv',csv_text:SAMPLE_LOG,sha256:await flightCSVHash(SAMPLE_LOG),model_version:LOG_VERSION,samples:parseFlightCSV(SAMPLE_LOG)};text=await createReviewCase(log,{title:'PRIVATE title',notes:'PRIVATE notes'},{markers:[{id:'PRIVATE-marker',time_s:8,kind:'Question',text:'PRIVATE marker',discussed:false}],notes:'PRIVATE discussion'},{profile:{name:'PRIVATE profile',maxAltitude:30,maxSpeed:null,minBattery:93},notes:'PRIVATE envelope'});await writeFile(left,text);await writeFile(right,text);
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('compares validated identical snapshots without private output, writes or fabricated chronology',async()=>{
 const files=await readdir(dir),r=check(),data=success(r);expect(data.exact_artifact_bytes_equal).toBe(true);expect(data.validated_content_equal).toBe(true);expect(data.source_bytes_equal).toBe(true);expect(data.left.exact_bundle_sha256).toBe(hash(text));expect(data.left.expected_bundle_digest_matched).toBe(false);expect(data.right.expected_bundle_digest_matched).toBe(false);expect(data.review.comparable).toBe(true);for(const[key,value]of Object.entries(data.review))if(key!=='comparable')expect(value).toBe('unchanged');for(const secret of ['PRIVATE','28.6139','77.209','maxAltitude'])expect(r.stdout).not.toContain(secret);expect(await readdir(dir)).toEqual(files);expect(await readFile(left,'utf8')).toBe(text);expect(await readFile(right,'utf8')).toBe(text);
});
it('separates raw artifact bytes from normalized object-key order and JSON formatting, preserving exact text',async()=>{
 const data=JSON.parse(text);await writeFile(right,JSON.stringify(Object.fromEntries(Object.entries(data).reverse()))+'\n');let r=success(check());expect(r.exact_artifact_bytes_equal).toBe(false);expect(r.validated_content_equal).toBe(true);expect(r.review.analyst_notes).toBe('unchanged');await modify(data=>{data.review.notes+=' ';});r=success(check());expect(r.validated_content_equal).toBe(false);expect(r.review.analyst_notes).toBe('changed');
});
it.each(['title','analyst_notes','instructor_markers','instructor_discussion','envelope_profile','envelope_notes'])('flags only the affected %s section on the same exact source',async section=>{
 const mutations={title:d=>{d.review.title+='x';},analyst_notes:d=>{d.review.notes+='x';},instructor_markers:d=>{d.debrief.markers[0].discussed=true;},instructor_discussion:d=>{d.debrief.notes+='x';},envelope_profile:d=>{d.envelope.profile.maxAltitude=31;},envelope_notes:d=>{d.envelope.notes+='x';}};await modify(mutations[section]);const r=success(check());expect(r.source_bytes_equal).toBe(true);expect(r.review.comparable).toBe(true);for(const[key,value]of Object.entries(r.review))if(key!=='comparable')expect(value).toBe(key===section?'changed':'unchanged');
});
it('treats envelope removal/addition as a change without computing a grade or inferring a policy transition',async()=>{
 await modify(d=>{d.envelope=null;});let r=success(check());expect(r.review.envelope_profile).toBe('changed');expect(r.review.envelope_notes).toBe('changed');const swapped=success(run(right,left));expect(swapped.review).toEqual(r.review);expect(swapped.left.exact_bundle_sha256).toBe(r.right.exact_bundle_sha256);
});
it('gates every review comparison on exact source bytes even with same IDs/notes and uses filename equality only as metadata',async()=>{
 await modify(async d=>{d.source.csv_text=d.source.csv_text.replace('28.6139','28.6138');d.source.sha256=await flightCSVHash(d.source.csv_text);d.debrief.source_sha256=d.source.sha256;});const r=success(check());expect(r.source_bytes_equal).toBe(false);expect(r.review.comparable).toBe(false);for(const[key,value]of Object.entries(r.review))if(key!=='comparable')expect(value).toBe('not_compared_source_changed');expect(r.source_filename_changed).toBe(false);
});
it('reports changed filename separately without suppressing matching-source review comparisons',async()=>{
 await modify(d=>{d.source.filename='PRIVATE-renamed.csv';});const r=success(check());expect(r.source_filename_changed).toBe(true);expect(r.source_bytes_equal).toBe(true);expect(r.review.analyst_notes).toBe('unchanged');expect(r.validated_content_equal).toBe(false);
});
it('pins each exact complete artifact independently, accepts uppercase and does not treat a source hash as an artifact expectation',async()=>{
 let r=success(check('--expect-right-sha256',hash(text).toUpperCase(),'--expect-left-sha256',hash(text).toUpperCase()));expect(r.left.expected_bundle_digest_matched).toBe(true);expect(r.right.expected_bundle_digest_matched).toBe(true);r=success(check('--expect-left-sha256',hash(text)));expect(r.left.expected_bundle_digest_matched).toBe(true);expect(r.right.expected_bundle_digest_matched).toBe(false);failure(check('--expect-left-sha256',log.sha256));await writeFile(right,text+'\n');failure(check('--expect-right-sha256',hash(text)));
});
it.each(['source-hash','marker-bound','model','invalid-utf8','oversize','malformed'])('rejects either %s input without partial receipt or private error echo',async kind=>{
 const d=JSON.parse(text);if(kind==='source-hash')d.source.sha256='f'.repeat(64);if(kind==='marker-bound')d.debrief.markers[0].time_s=999;if(kind==='model')d.replay_model='future';const bad=kind==='invalid-utf8'?Buffer.from([0xff]):kind==='oversize'?'x'.repeat(2*1024*1024+1):kind==='malformed'?'PRIVATE invalid':JSON.stringify(d);await writeFile(right,bad);failure(check());await writeFile(right,text);await writeFile(left,bad);failure(check());
});
it('offers help and rejects missing/extra/directory paths and malformed/duplicate/unknown pin options',()=>{
 expect(run('--help').status).toBe(0);for(const args of [[],[left],[dir,right],[left,right,'extra'],[left,right,'--expect-left-sha256','bad'],[left,right,'--expect-right-sha256'],[left,right,'--unknown',hash(text)],[left,right,'--expect-left-sha256',hash(text),'--expect-left-sha256',hash(text)]])failure(run(...args));
});
