import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto, createHash } from 'node:crypto';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { SAMPLE_LOG, parseFlightCSV, flightCSVHash, LOG_VERSION } from './flightLog';
let dir, left, right, text, snapshot, pair;
const run = (...args) => spawnSync(process.execPath, ['scripts/compare-paired-reviews.mjs', ...args], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 20000 });
const compare = () => { const result = run(left,right); expect(result.status).toBe(0); return JSON.parse(result.stdout); };
const saveRight = async () => writeFile(right,await createPairedReviewBundle(snapshot,pair));
beforeEach(async () => {
  vi.stubGlobal('crypto',webcrypto); dir=await mkdtemp(join(tmpdir(),'skydash-revisions-')); left=join(dir,'left.json'); right=join(dir,'right.json');
  const log={ filename:'PRIVATE.csv',title:'PRIVATE title',csv_text:SAMPLE_LOG,sha256:await flightCSVHash(SAMPLE_LOG),model_version:LOG_VERSION,samples:parseFlightCSV(SAMPLE_LOG) };
  snapshot={ log,review:{title:log.title,notes:'PRIVATE analyst'},debrief:{markers:[{id:'PRIVATE-marker',time_s:4,kind:'Question',text:'PRIVATE marker text',discussed:false}],notes:'PRIVATE instructor'},envelope:{profile:{name:'PRIVATE criteria',maxAltitude:30,maxSpeed:null,minBattery:null},notes:'PRIVATE criteria notes'} };
  pair={baseline:{...log},notes:'PRIVATE comparison',alignment:{primaryIndex:1,baselineIndex:2,label:'PRIVATE anchor'}};
  text=await createPairedReviewBundle(snapshot,pair); await writeFile(left,text);await writeFile(right,text);
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('compares validated exact artifacts without echoing private content or writing any files',async()=>{
  const files=await readdir(dir),result=run(left,right);expect(result.status).toBe(0);const data=JSON.parse(result.stdout);expect(data.exact_artifact_bytes_equal).toBe(true);expect(data.validated_content_equal).toBe(true);expect(data.primary_review.comparable).toBe(true);expect(data.primary_review.analyst_notes).toBe('unchanged');expect(data.comparison_review.applied_anchors).toBe('unchanged');for(const secret of ['PRIVATE','28.6139','77.209','left.json','right.json'])expect(result.stdout).not.toContain(secret);expect(await readdir(dir)).toEqual(files);expect(await readFile(left,'utf8')).toBe(text);expect(await readFile(right,'utf8')).toBe(text);
});
it('distinguishes formatting or key-order changes from validated-content edits',async()=>{
  const raw=JSON.parse(text);await writeFile(right,JSON.stringify(Object.fromEntries(Object.entries(raw).reverse()))+'\n');const data=compare();expect(data.exact_artifact_bytes_equal).toBe(false);expect(data.validated_content_equal).toBe(true);expect(data.primary_review.instructor_markers).toBe('unchanged');expect(data.comparison_review.notes).toBe('unchanged');
});
it('identifies listed private review section changes on identical ordered sources without printing old or new values',async()=>{
  snapshot.review={title:'CHANGED private title',notes:'CHANGED analyst'};snapshot.debrief.markers[0].discussed=true;snapshot.debrief.notes='CHANGED instructor';snapshot.envelope.profile.maxAltitude=32;snapshot.envelope.notes='CHANGED criteria';pair.notes='CHANGED comparison';pair.alignment.label='CHANGED anchor';await saveRight();const data=compare();expect(data.validated_content_equal).toBe(false);for(const [key,value]of Object.entries(data.primary_review))if(key!=='comparable')expect(value).toBe('changed');expect(data.comparison_review.notes).toBe('changed');expect(data.comparison_review.applied_anchors).toBe('changed');expect(JSON.stringify(data)).not.toContain('CHANGED');
});
it('suppresses every source-bound review comparison when primary source bytes change, even with matching review text',async()=>{
  const csv=SAMPLE_LOG.replace('28.61390','28.61391');snapshot.log={...snapshot.log,csv_text:csv,sha256:await flightCSVHash(csv),samples:parseFlightCSV(csv)};await saveRight();const data=compare();expect(data.source_roles.primary_bytes_equal).toBe(false);expect(data.source_roles.baseline_bytes_equal).toBe(true);expect(data.primary_review.comparable).toBe(false);for(const[key,value]of Object.entries(data.primary_review))if(key!=='comparable')expect(value).toBe('not_compared_source_changed');expect(data.comparison_review.notes).toBe('not_compared_source_changed');
});
it('keeps matching primary review comparable but suppresses comparison annotations when baseline bytes change',async()=>{
  const csv=SAMPLE_LOG.replace('28.61390','28.61391');pair.baseline={...pair.baseline,csv_text:csv,sha256:await flightCSVHash(csv),samples:parseFlightCSV(csv)};pair.notes='CHANGED baseline discussion';await saveRight();const data=compare();expect(data.primary_review.comparable).toBe(true);expect(data.primary_review.analyst_notes).toBe('unchanged');expect(data.comparison_review.comparable).toBe(false);expect(data.comparison_review.notes).toBe('not_compared_source_changed');expect(data.comparison_review.applied_anchors).toBe('not_compared_source_changed');
});
it('reports metadata-only changes separately and preserves envelope absence/null distinctions',async()=>{
  snapshot.log.filename='CHANGED source.csv';pair.baseline.filename='CHANGED baseline.csv';pair.baseline.title='CHANGED baseline';snapshot.envelope=null;await saveRight();const data=compare();expect(data.metadata).toEqual({primary_filename:'changed',baseline_filename:'changed',baseline_title:'changed'});expect(data.primary_review.envelope_profile).toBe('changed');expect(data.primary_review.envelope_notes).toBe('changed');expect(data.primary_review.analyst_notes).toBe('unchanged');expect(data.source_roles.ordered_pair_bytes_equal).toBe(true);
});
it.each(['malformed','invalid_utf8','bad_nested_hash','oversized'])('rejects either %s artifact without a partial success receipt or private error echo',async kind=>{
  const bad=JSON.parse(text);bad.comparison.baseline.sha256='b'.repeat(64);const content={malformed:'PRIVATE malformed',invalid_utf8:Buffer.from([0xff]),bad_nested_hash:JSON.stringify(bad),oversized:'x'.repeat(4*1024*1024+1)}[kind];{await writeFile(right,content);let result=run(left,right);expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).not.toContain('PRIVATE');result=run(right,left);expect(result.status).toBe(1);expect(result.stdout).toBe('');}
});
it('offers scope help and refuses missing, extra, nonexistent and non-file inputs',()=>{expect(run('--help').status).toBe(0);expect(run(left).status).toBe(1);expect(run(left,right,'extra').status).toBe(1);expect(run(left,join(dir,'missing')).status).toBe(1);expect(run(dir,right).status).toBe(1);});

it('does not rematch swapped source roles and compares markers after shared validator normalization, not inferred event history',async()=>{
  const csv=SAMPLE_LOG.replace('28.61390','28.61391'),other={...snapshot.log,csv_text:csv,sha256:await flightCSVHash(csv),samples:parseFlightCSV(csv)};pair.baseline=other;await writeFile(left,await createPairedReviewBundle(snapshot,pair));pair.baseline=snapshot.log;snapshot.log=other;await saveRight();let data=compare();expect(data.source_roles).toEqual({primary_bytes_equal:false,baseline_bytes_equal:false,ordered_pair_bytes_equal:false});expect(data.primary_review.instructor_markers).toBe('not_compared_source_changed');expect(data.comparison_review.notes).toBe('not_compared_source_changed');
  snapshot.debrief.markers.push({id:'PRIVATE-second',time_s:4,kind:'Question',text:'PRIVATE second',discussed:false});await writeFile(left,await createPairedReviewBundle(snapshot,pair));const reordered=JSON.parse(await readFile(left,'utf8'));reordered.primary_case.debrief.markers.reverse();await writeFile(right,JSON.stringify(reordered));data=compare();expect(data.source_roles.ordered_pair_bytes_equal).toBe(true);expect(data.primary_review.instructor_markers).toBe('unchanged');expect(data.validated_content_equal).toBe(true);expect(data.exact_artifact_bytes_equal).toBe(false);expect(data).not.toHaveProperty('added_markers');
});

it('checks independently expected full-artifact hashes per side before parsing without changing source-based revision semantics', async()=>{
 const pin=bytes=>createHash('sha256').update(bytes).digest('hex'), raw=await readFile(left), expected=pin(raw);
 let result=run(left,right,'--expect-right-sha256',expected.toUpperCase(),'--expect-left-sha256',expected), receipt=JSON.parse(result.stdout);
 expect(result.status,result.stderr).toBe(0);expect(receipt.left.expected_bundle_digest_matched).toBe(true);expect(receipt.right.expected_bundle_digest_matched).toBe(true);
 result=run(left,right,'--expect-right-sha256',expected);expect(result.status).toBe(0);receipt=JSON.parse(result.stdout);expect(receipt.left.expected_bundle_digest_matched).toBe(false);expect(receipt.right.expected_bundle_digest_matched).toBe(true);
 await writeFile(right,Buffer.concat([raw,Buffer.from('\n')]));result=run(left,right,'--expect-right-sha256',expected);expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).not.toContain('PRIVATE');
 for(const args of [['--expect-left-sha256','f'.repeat(64)],['--expect-left-sha256','bad'],['--expect-right-sha256'],['--unknown',expected],['--expect-left-sha256',expected,'--expect-left-sha256',expected]]){result=run(left,right,...args);expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).not.toContain('PRIVATE');}
});

it('does not bypass nested artifact validation merely because a supplied full-file expectation matches', async()=>{
 const malformed=Buffer.from('PRIVATE malformed JSON');await writeFile(right,malformed);const expected=createHash('sha256').update(malformed).digest('hex');
 const result=run(left,right,'--expect-right-sha256',expected);expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).not.toContain('PRIVATE');
});
