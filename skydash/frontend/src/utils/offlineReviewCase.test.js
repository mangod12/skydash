import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { mkdtemp,readFile,writeFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash,webcrypto } from 'node:crypto';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG,parseFlightCSV,flightCSVHash,LOG_VERSION } from './flightLog';
let dir,path,manifest,text,log,caseEntry;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(script,...args)=>spawnSync(process.execPath,['scripts/'+script+'.mjs',...args],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',timeout:20000});
const check=(...args)=>run('verify-review-case',...args);
const intake=(...args)=>run('verify-training-manifest',...args);
const success=r=>{expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);};
const failure=r=>{expect(r.status).toBe(1);expect(r.stdout).toBe('');for(const secret of ['PRIVATE','28.6139','77.209'])expect(r.stderr).not.toContain(secret);};
const save=(format='skydash-training-intake-manifest-v2',bundles=[caseEntry])=>writeFile(manifest,JSON.stringify({format,bundles}));
beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-case-intake-'));path=join(dir,'PRIVATE-case.json');manifest=join(dir,'PRIVATE-manifest.json');log={filename:'PRIVATE.csv',title:'PRIVATE title',notes:'PRIVATE analyst',csv_text:SAMPLE_LOG,sha256:await flightCSVHash(SAMPLE_LOG),model_version:LOG_VERSION,samples:parseFlightCSV(SAMPLE_LOG)};text=await createReviewCase(log,{title:log.title,notes:log.notes},{markers:[{id:'PRIVATE-marker',time_s:8,kind:'Question',text:'PRIVATE marker text',discussed:true}],notes:'PRIVATE discussion'},{profile:{name:'PRIVATE criteria',maxAltitude:30,maxSpeed:null,minBattery:93},notes:'PRIVATE envelope'});await writeFile(path,text);caseEntry={kind:'case',path:'PRIVATE-case.json',sha256:hash(text)};await save();
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('uses actual app nested case validators, independently checks raw artifact pin and prints no private payload or writes',async()=>{
 const files=await readdir(dir),r=check(path,'--expect-sha256',hash(text).toUpperCase()),data=success(r);expect(data.exact_bundle_sha256).toBe(hash(text));expect(data.expected_bundle_digest_matched).toBe(true);expect(data.source).toEqual({sha256:log.sha256,samples:6,start_s:0,end_s:16});expect(data.included_reviews).toEqual({instructor_markers:1,evaluated_envelope:true});for(const secret of ['PRIVATE','28.6139','77.209'])expect(r.stdout).not.toContain(secret);expect(await readdir(dir)).toEqual(files);expect(await readFile(path,'utf8')).toBe(text);
});
it('keeps source fingerprints separate from full-artifact pins including whitespace and notes',async()=>{
 const first=success(check(path));expect(first.expected_bundle_digest_matched).toBe(false);await writeFile(path,text+'\n');failure(check(path,'--expect-sha256',hash(text)));const r=success(check(path));expect(r.source.sha256).toBe(first.source.sha256);expect(r.exact_bundle_sha256).not.toBe(first.exact_bundle_sha256);const changed=JSON.parse(text);changed.review.notes+=' changed';await writeFile(path,JSON.stringify(changed));expect(success(check(path)).source.sha256).toBe(first.source.sha256);failure(check(path,'--expect-sha256',log.sha256));
});
it.each(['malformed','utf8','oversize','source-hash','model','marker-bound','envelope','computed','source-csv'])('rejects %s without success or private echo',async kind=>{
 const data=JSON.parse(text);if(kind==='source-hash')data.source.sha256='f'.repeat(64);if(kind==='model')data.replay_model='future';if(kind==='marker-bound')data.debrief.markers[0].time_s=999; if(kind==='envelope')data.envelope.profile.maxAltitude='PRIVATE invalid';if(kind==='computed')data.report='PRIVATE';if(kind==='source-csv'){data.source.csv_text='PRIVATE malformed';data.source.sha256=await flightCSVHash(data.source.csv_text);}await writeFile(path,kind==='malformed'?'PRIVATE malformed':kind==='utf8'?Buffer.from([0xff]):kind==='oversize'?'x'.repeat(2*1024*1024+1):JSON.stringify(data));failure(check(path));
});
it('accepts a valid case without envelope or markers without manufacturing review results',async()=>{
 const data=await createReviewCase(log,{title:'PRIVATE',notes:''},{markers:[],notes:''},null);await writeFile(path,data);expect(success(check(path)).included_reviews).toEqual({instructor_markers:0,evaluated_envelope:false});
});
it('explicit v2 accepts mixed case/notebook/paired kinds and indexes exact source reuse across all four roles',async()=>{
 const notebook=await createNotebookSourceBundle(log,[{id:'PRIVATE',first_row:3,last_row:5,label:'PRIVATE',notes:''}]),paired=await createPairedReviewBundle({log,review:{title:'PRIVATE',notes:''},debrief:{markers:[],notes:''},envelope:null},{baseline:log,notes:'',alignment:null});await writeFile(join(dir,'notebook.json'),notebook);await writeFile(join(dir,'paired.json'),paired);await save(undefined,[caseEntry,{kind:'notebook',path:'notebook.json',sha256:hash(notebook)},{kind:'paired',path:'paired.json',sha256:hash(paired)}]);const r=intake(manifest),receipt=success(r);expect(receipt.format).toBe('skydash-training-intake-receipt-v2');expect(receipt.receipts.map(item=>item.kind)).toEqual(['case','notebook','paired']);expect(receipt.repeated_sources[0].references).toEqual([{ordinal:1,role:'source'},{ordinal:2,role:'source'},{ordinal:3,role:'primary'},{ordinal:3,role:'baseline'}]);expect(r.stdout).not.toContain('PRIVATE');expect(receipt).not.toHaveProperty('total_samples');
});
it('retains v1 format semantics, rejects case kind in v1 and refuses mismatched type/schema/late failures',async()=>{
 await save('skydash-training-intake-manifest-v1');failure(intake(manifest));for(const kind of ['paired','notebook','future']){await save(undefined,[{...caseEntry,kind}]);failure(intake(manifest));}await save(undefined,[caseEntry,{...caseEntry,path:'missing.json'}]);failure(intake(manifest));await save('future');failure(intake(manifest));
});
it('v2 preserves existing mandatory per-file and optional complete-manifest pins with kind-specific2MiB cap',async()=>{
 const pin=hash(await readFile(manifest));expect(success(intake(manifest,'--expect-sha256',pin.toUpperCase())).expected_manifest_digest_matched).toBe(true);await writeFile(manifest,(await readFile(manifest,'utf8'))+'\n');failure(intake(manifest,'--expect-sha256',pin));await save(undefined,[{...caseEntry,sha256:'e'.repeat(64)}]);failure(intake(manifest));await save();await writeFile(path,'x'.repeat(2*1024*1024+1));failure(intake(manifest));
});
it('offers help, rejects missing/extra/directory arguments and strict expected digest syntax',()=>{expect(check('--help').status).toBe(0);for(const args of [[],[dir],[path,'extra'],[path,'--expect-sha256','bad'],[path,'--unknown','f'.repeat(64)],[path,'--expect-sha256',hash(text),'--expect-sha256',hash(text)]])failure(check(...args));});
it('v2 case source links to its independently pinned reproduced conversion in the combined lineage verifier',async()=>{
 const { convertMappedCSV,readMappingCSV }=await import('./csvColumnMapping');const { exportMappingRecipe }=await import('./mappingRecipe');
 const raw='clock,lat,lon\n1000,28.6,77.2\n3000,28.61,77.21\n',mapping={columns:{time_s:0,latitude:1,longitude:2,altitude_m:null,ground_speed_m_s:null,battery_pct:null},timeUnit:'ms',timeOrigin:'subtract-first',altitudeUnit:'m',speedUnit:'m/s',coordinateReference:'WGS84-decimal-degrees'},recipe=exportMappingRecipe(readMappingCSV(raw).headers,mapping,'PRIVATE'),mapped=await convertMappedCSV(raw,'PRIVATE.csv',mapping),caseText=await createReviewCase({...mapped,filename:'PRIVATE.csv',model_version:LOG_VERSION},{title:'PRIVATE',notes:''},{markers:[],notes:''},null);
 await writeFile(path,caseText);await save(undefined,[{...caseEntry,sha256:hash(caseText)}]);const files={original:['original.csv',raw],recipe:['recipe.json',recipe],converted:['converted.csv',mapped.csv_text]};for(const [name,text] of Object.values(files))await writeFile(join(dir,name),text);const lineage=join(dir,'lineage.json');await writeFile(lineage,JSON.stringify({format:'skydash-training-lineage-manifest-v1',conversions:[Object.fromEntries(Object.entries(files).map(([role,[path,text]])=>[role,{path,sha256:hash(text)}]))]}));const r=run('verify-training-lineage',manifest,lineage,'--confirm-wgs84','--require-all-review-sources'),receipt=success(r);expect(receipt.all_review_sources_linked).toBe(true);expect(receipt.training.format).toBe('skydash-training-intake-receipt-v2');expect(receipt.review_sources.map(source=>[source.kind,source.role,source.matching_conversion_ordinals])).toEqual([['case','source',[1]]]);expect(r.stdout).not.toContain('PRIVATE');
});
