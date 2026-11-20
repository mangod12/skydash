import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { mkdtemp,readFile,writeFile,rm,readdir,symlink,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { createHash,webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { convertMappedCSV,readMappingCSV } from './csvColumnMapping';
import { exportMappingRecipe } from './mappingRecipe';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG,parseFlightCSV,flightCSVHash,LOG_VERSION } from './flightLog';
let dir,training,lineage,data,original,recipe,converted,mapping,log,noteText,pairText;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(...args)=>spawnSync(process.execPath,['scripts/verify-training-lineage.mjs',...args],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',timeout:20000});
const check=(...args)=>run(training,lineage,'--confirm-wgs84',...args);
const success=r=>{expect(r.status,r.stderr).toBe(0);return JSON.parse(r.stdout);};
const failure=r=>{expect(r.status).toBe(1);expect(r.stdout).toBe('');expect(r.stderr).not.toContain('PRIVATE');expect(r.stderr).not.toContain('28.6');};
const save=()=>writeFile(lineage,JSON.stringify(data));
const file=(path,text)=>({path,sha256:hash(text)});
beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-package-lineage-'));training=join(dir,'PRIVATE-training.json');lineage=join(dir,'PRIVATE-lineage.json');
 original='clock,lat,lon,height,speed,battery,PRIVATE-extra\n1000,28.6,77.2,100,36,95,PRIVATE-value\n3000,28.61,77.21,,0,0,PRIVATE-second\n';mapping={columns:{time_s:0,latitude:1,longitude:2,altitude_m:3,ground_speed_m_s:4,battery_pct:5},timeUnit:'ms',timeOrigin:'subtract-first',altitudeUnit:'ft',speedUnit:'km/h',coordinateReference:'WGS84-decimal-degrees'};recipe=exportMappingRecipe(readMappingCSV(original).headers,mapping,'PRIVATE recipe label');converted=await convertMappedCSV(original,'PRIVATE-original.csv',mapping);log={...converted,title:'PRIVATE title',notes:'',filename:'PRIVATE-converted.csv',model_version:LOG_VERSION,samples:parseFlightCSV(converted.csv_text)};
 noteText=await createNotebookSourceBundle(log,[{id:'PRIVATE-copy',first_row:1,last_row:2,label:'PRIVATE label',notes:'PRIVATE notes'}]);pairText=await createPairedReviewBundle({log,review:{title:'PRIVATE',notes:'PRIVATE analyst'},debrief:{markers:[],notes:''},envelope:null},{baseline:log,notes:'PRIVATE comparison',alignment:null});
 for(const [name,text] of [['PRIVATE-original.csv',original],['PRIVATE-recipe.json',recipe],['PRIVATE-converted.csv',converted.csv_text],['PRIVATE-notebook.json',noteText],['PRIVATE-paired.json',pairText]])await writeFile(join(dir,name),text);
 await writeFile(training,JSON.stringify({format:'skydash-training-intake-manifest-v1',bundles:[{kind:'notebook',...file('PRIVATE-notebook.json',noteText)},{kind:'paired',...file('PRIVATE-paired.json',pairText)}]}));
 data={format:'skydash-training-lineage-manifest-v1',conversions:[{original:file('PRIVATE-original.csv',original),recipe:file('PRIVATE-recipe.json',recipe),converted:file('PRIVATE-converted.csv',converted.csv_text)}]};await save();
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('checks all three independent pins, actual conversion and mixed nested bundles, then links exact source roles without private data or writes',async()=>{
 const files=await readdir(dir),before=await Promise.all(files.map(name=>readFile(join(dir,name))));const r=check('--require-all-review-sources','--expect-training-sha256',hash(await readFile(training)).toUpperCase(),'--expect-lineage-sha256',hash(await readFile(lineage)).toUpperCase()),receipt=success(r);
 expect(receipt.all_review_sources_linked).toBe(true);expect(receipt.require_all_review_sources).toBe(true);expect(receipt.expected_lineage_manifest_digest_matched).toBe(true);expect(receipt.training.expected_manifest_digest_matched).toBe(true);expect(receipt.conversions[0].receipt.exact_original_sha256).toBe(hash(original));expect(receipt.conversions[0].receipt.exact_recipe_sha256).toBe(hash(recipe));expect(receipt.review_sources.map(s=>[s.bundle_ordinal,s.kind,s.role,s.matching_conversion_ordinals])).toEqual([[1,'notebook','source',[1]],[2,'paired','primary',[1]],[2,'paired','baseline',[1]]]);expect(receipt.unreferenced_conversion_ordinals).toEqual([]);
 for(const secret of ['PRIVATE','28.6','77.2','30.48'])expect(r.stdout).not.toContain(secret);expect(receipt).not.toHaveProperty('total_samples');expect(await readdir(dir)).toEqual(files);expect(await Promise.all(files.map(name=>readFile(join(dir,name))))).toEqual(before);
});
it('reports unlinked source roles without guessing native-vs-missing lineage and require-all refuses any missing exact relation',async()=>{
 const other={filename:'PRIVATE-other.csv',model_version:LOG_VERSION,csv_text:SAMPLE_LOG,sha256:await flightCSVHash(SAMPLE_LOG),samples:parseFlightCSV(SAMPLE_LOG)};const text=await createNotebookSourceBundle(other,[{id:'x',first_row:1,last_row:2,label:'PRIVATE',notes:''}]);await writeFile(join(dir,'other.json'),text);await writeFile(training,JSON.stringify({format:'skydash-training-intake-manifest-v1',bundles:[{kind:'notebook',...file('other.json',text)}]}));const r=success(check());expect(r.all_review_sources_linked).toBe(false);expect(r.review_sources[0].matching_conversion_ordinals).toEqual([]);expect(r.unreferenced_conversion_ordinals).toEqual([1]);failure(check('--require-all-review-sources'));
});
it('keeps multiple exact conversion relations separate when different original extra data and recipe labels produce the same converted bytes',async()=>{
 const raw=original.replace('PRIVATE-value','PRIVATE-different'),recipe2=exportMappingRecipe(readMappingCSV(raw).headers,mapping,'PRIVATE different recipe');const result=await convertMappedCSV(raw,'x.csv',mapping);expect(result.csv_text).toBe(converted.csv_text);for(const [name,text] of [['o2.csv',raw],['r2.json',recipe2],['c2.csv',result.csv_text]])await writeFile(join(dir,name),text);data.conversions.push({original:file('o2.csv',raw),recipe:file('r2.json',recipe2),converted:file('c2.csv',result.csv_text)});await save();const r=success(check());expect(r.review_sources.every(source=>JSON.stringify(source.matching_conversion_ordinals)==='[1,2]')).toBe(true);expect(r.conversions[0].receipt.exact_original_sha256).not.toBe(r.conversions[1].receipt.exact_original_sha256);expect(r.conversions[0].receipt.exact_recipe_sha256).not.toBe(r.conversions[1].receipt.exact_recipe_sha256);
});
it.each(['original','recipe','converted'])('rejects a wrong independently expected %s digest without a partial receipt',async role=>{data.conversions[0][role].sha256='a'.repeat(64);await save();failure(check());});
it.each(['original','recipe','converted'])('rejects changed %s even when its expected pin is updated if actual conversion no longer holds',async role=>{
 let text=role==='original'?original.replace('28.6,','28.7,'):role==='recipe'?recipe.replace('"altitudeUnit": "ft"','"altitudeUnit": "m"'):converted.csv_text+'\n';expect(text).not.toBe(role==='original'?original:role==='recipe'?recipe:converted.csv_text);await writeFile(join(dir,data.conversions[0][role].path),text);data.conversions[0][role].sha256=hash(text);await save();failure(check());
});
it('checks optional raw manifest pins, including formatting, never accepts a pin from manifest data',async()=>{
 const pin=hash(await readFile(lineage));await writeFile(lineage,(await readFile(lineage,'utf8'))+'\n');failure(check('--expect-lineage-sha256',pin));expect(success(check()).expected_lineage_manifest_digest_matched).toBe(false);failure(check('--expect-training-sha256','b'.repeat(64)));data.confirmedWGS84=true;await save();failure(check());
});
it.each(['../escape.csv','./PRIVATE-original.csv','nested/../PRIVATE-original.csv','nested//file.csv','nested\\file.csv','PRIVATE-lineage.json','/tmp/PRIVATE.csv'])('rejects disallowed path %s before receipt',async path=>{data.conversions[0].original.path=path;await save();failure(check());});
it('rejects duplicate canonical aliases, outside symlinks and directories but accepts an explicit nested in-folder path',async()=>{
 await symlink(join(dir,'PRIVATE-original.csv'),join(dir,'alias.csv'));data.conversions[0].converted.path='alias.csv';await save();failure(check());data.conversions[0].converted=file('PRIVATE-converted.csv',converted.csv_text);await symlink(tmpdir(),join(dir,'outside'));data.conversions[0].original.path='outside/PRIVATE.csv';await save();failure(check());await mkdir(join(dir,'nested'));data.conversions[0].original.path='nested';await save();failure(check());await writeFile(join(dir,'nested','original.csv'),original);data.conversions[0].original.path='nested/original.csv';await save();success(check());
});
it.each(['bad-format','empty','too-many','unknown-field','bad-utf8','too-large','bad-entry'])('rejects lineage manifest case %s with no receipt',async kind=>{
 if(kind==='bad-format')data.format='future';if(kind==='empty')data.conversions=[];if(kind==='too-many')data.conversions=Array.from({length:21},()=>data.conversions[0]);if(kind==='unknown-field')data.extra='PRIVATE';if(kind==='bad-entry')data.conversions[0].recipe.extra='PRIVATE';await save();if(kind==='bad-utf8')await writeFile(lineage,Buffer.from([0xff]));if(kind==='too-large')await writeFile(lineage,'x'.repeat(65537));failure(check());
});
it.each(['original','recipe','converted'])('applies %s individual file-size limits',async role=>{await writeFile(join(dir,data.conversions[0][role].path),'x'.repeat((role==='recipe'?65536:1048576)+1));failure(check());});
it('rejects late invalid training bundle after valid conversion without partial success or writes',async()=>{const broken=JSON.parse(noteText);broken.source.csv_text+='\n';const text=JSON.stringify(broken);await writeFile(join(dir,'PRIVATE-notebook.json'),text);const t=JSON.parse(await readFile(training));t.bundles[0].sha256=hash(text);await writeFile(training,JSON.stringify(t));failure(check());});
it('fresh confirmation cannot be replaced by a manifest/recipe field and all CLI options are strict',()=>{
 expect(run('--help').status).toBe(0);for(const args of [[],[training,lineage],[training,lineage,'--trust-manifest'],[training,lineage,'--confirm-wgs84','--confirm-wgs84'],[training,lineage,'--confirm-wgs84','--require-all-review-sources','--require-all-review-sources'],[training,lineage,'--confirm-wgs84','--expect-lineage-sha256','bad'],[training,lineage,'--confirm-wgs84','--unknown'],[training,lineage,'--confirm-wgs84','extra']])failure(run(...args));
});
it('applies the aggregate20MiB lineage preflight budget across unique files before conversion or a receipt',async()=>{
 data.conversions=[];const raw='x'.repeat(1048576);for(let index=0;index<11;index++){const entry={};for(const role of ['original','recipe','converted']){const name=`${index}-${role}`,text=role==='recipe'?'{}':raw;await writeFile(join(dir,name),text);entry[role]=file(name,text);}data.conversions.push(entry);}await save();failure(check());
});
it('accepts exactly20explicit conversion relations without collapsing identical bytes or inventing independence',async()=>{
 for(let index=1;index<20;index++){const entry={};for(const [role,text] of [['original',original],['recipe',recipe],['converted',converted.csv_text]]){const name=`${index}-${role}`;await writeFile(join(dir,name),text);entry[role]=file(name,text);}data.conversions.push(entry);}await save();const r=success(check('--require-all-review-sources'));expect(r.conversions).toHaveLength(20);expect(r.review_sources[0].matching_conversion_ordinals).toEqual(Array.from({length:20},(_,i)=>i+1));expect(r.unreferenced_conversion_ordinals).toEqual([]);
});
