import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { webcrypto,createHash } from 'node:crypto';
import { mkdtemp,readFile,rm,writeFile,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticTrainingOriginals } from './syntheticTrainingOriginals';
import { browserSyntheticTrainingStarter } from './browserSyntheticTrainingStarter';
import { checkBrowserTrainingArchive } from './checkBrowserTrainingArchive';
import { createTrainingExample } from '../../scripts/create-training-example.mjs';
import { verifyTrainingManifest } from '../../scripts/verify-training-manifest.mjs';
import { reportTrainingIntake } from '../../scripts/report-training-intake.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let dir;
beforeEach(async()=>{vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-synthetic-browser-'));});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
function entries(bytes){const b=Buffer.from(bytes),out=[];let offset=0;while(b.readUInt32LE(offset)===0x04034b50){const size=b.readUInt32LE(offset+22),length=b.readUInt16LE(offset+26),start=offset+30+length;out.push([b.subarray(offset+30,start).toString(),b.subarray(start,start+size)]);offset=start+size;}return out;}
it('shared generator yields byte-identical original and mapping files to the ordinary CLI starter',async()=>{
  const generated=await syntheticTrainingOriginals(),kit=join(dir,'kit');await createTrainingExample(kit);for(const[name,text]of Object.entries(generated.files))expect(await readFile(join(kit,name),'utf8')).toBe(text);expect(await readFile(join(kit,'training.json'),'utf8')).toBe(generated.training);for(const[name,text]of Object.entries(generated.lineageFiles))expect(await readFile(join(kit,'lineage',name),'utf8')).toBe(text);expect(await readFile(join(kit,'lineage','lineage.json'),'utf8')).toBe(generated.lineage);
});
it('fixed browser starter prepares and freshly checks without Buffer or external side effects; both independent expectations remain absent',async()=>{
  const fetch=vi.fn(()=>{throw Error('Unexpected network')});vi.stubGlobal('fetch',fetch);vi.stubGlobal('localStorage',{setItem:vi.fn(()=>{throw Error('Unexpected storage')})});vi.stubGlobal('indexedDB',{open:vi.fn(()=>{throw Error('Unexpected IDB')})});
  let result,checked;const old=globalThis.Buffer;try{globalThis.Buffer=undefined;result=await browserSyntheticTrainingStarter();checked=await checkBrowserTrainingArchive({name:'starter.zip',size:result.bytes.length,arrayBuffer:async()=>result.bytes});}finally{globalThis.Buffer=old;}
  expect(result.bundleCount).toBe(3);expect(result.fileCount).toBe(7);expect(result.bytes.length).toBeLessThan(30*1024*1024);expect(result.archiveDigest).toBe(hash(result.bytes));expect(checked.html).toBe(result.html);expect(checked.expectedArchiveDigestMatched).toBe(false);expect(checked.expectedManifestDigestMatched).toBe(false);expect(fetch).not.toHaveBeenCalled();expect(localStorage.setItem).not.toHaveBeenCalled();expect(indexedDB.open).not.toHaveBeenCalled();
});
it('contains only fixed fabricated manifest/case/notebook/paired originals and current report/projection/guide, not mapping extras or caller inputs',async()=>{
  const result=await browserSyntheticTrainingStarter(),items=entries(result.bytes);expect(items.map(([name])=>name)).toEqual(['training/training.json','training/case.json','training/notebook.json','training/paired.json','reports/intake-report.html','reports/validation.json','reports/READ-ME.txt']);
  const originals=join(dir,'originals');await mkdir(originals);for(const[name,bytes]of items.filter(([name])=>name.startsWith('training/')))await writeFile(join(originals,name.slice(9)),bytes);
  const checked=await verifyTrainingManifest(join(originals,'training.json'),{expectedSha256:result.digest});expect(checked.bundle_count).toBe(3);expect(checked.repeated_sources[0].references).toHaveLength(3);for(const[_name,bytes]of items.filter(([name])=>name.startsWith('training/')&&!name.endsWith('/training.json')))expect(bytes.toString()).toContain('SYNTHETIC');expect(result.html).toBe(await reportTrainingIntake(join(originals,'training.json')));expect(result.html).toContain('Conversion lineage not checked');
});
it('repeated calls produce deterministic bytes and do not retain caller-mutable previous output',async()=>{
  const first=await browserSyntheticTrainingStarter(),second=await browserSyntheticTrainingStarter();expect(first.bytes).toEqual(second.bytes);expect(first.bytes).not.toBe(second.bytes);first.bytes.fill(0);expect((await browserSyntheticTrainingStarter()).bytes).toEqual(second.bytes);
});
