import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserTrainingArchive, browserArchiveGuide } from './browserTrainingArchive';
import { storedZipBytes } from './storedZip';
import { storedZip } from '../../scripts/package-training-intake.mjs';
import { createTrainingExample } from '../../scripts/create-training-example.mjs';
import { verifyTrainingManifest } from '../../scripts/verify-training-manifest.mjs';
import { reportTrainingIntake } from '../../scripts/report-training-intake.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = (name, bytes) => ({name, size: bytes.length, arrayBuffer: vi.fn(async () => bytes)});
let dir, manifest, files;
function entries(bytes) {
  const result = []; let offset = 0; const b = Buffer.from(bytes);
  while (b.readUInt32LE(offset) === 0x04034b50) { const size=b.readUInt32LE(offset+22), length=b.readUInt16LE(offset+26), start=offset+30+length; result.push([b.subarray(offset+30,start).toString(),b.subarray(start,start+size)]); offset=start+size; }
  expect(Buffer.from(storedZipBytes(result))).toEqual(b); // Every header, CRC, central record and fixed date must roundtrip.
  return result;
}
async function alter(name, value) { const data = JSON.parse(await manifest.arrayBuffer()); Object.assign(data.bundles[0],value); manifest=file(name,Buffer.from(JSON.stringify(data))); }
beforeEach(async () => {
  vi.stubGlobal('crypto',webcrypto); dir=await mkdtemp(join(tmpdir(),'skydash-browser-archive-')); const kit=join(dir,'kit'); await createTrainingExample(kit);
  manifest=file('training.json',await readFile(join(kit,'training.json'))); files=await Promise.all(['case.json','notebook.json','paired.json'].map(async name=>file(name,await readFile(join(kit,name)))));
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('requires fresh exact acknowledgement before reading any inputs',async()=>{
  for(const options of [undefined,{}, {includeSensitiveOriginals:'true'}, {includeSensitiveOriginals:false}]) await expect(browserTrainingArchive(manifest,files,options)).rejects.toThrow('acknowledgement');
  expect(manifest.arrayBuffer).not.toHaveBeenCalled();for(const f of files)expect(f.arrayBuffer).not.toHaveBeenCalled();
});
it('keeps exact whole originals and CLI-identical fresh HTML without Buffer, and extracted originals pass the real CLI',async()=>{
  const pin=hash(await manifest.arrayBuffer());let result;const previous=globalThis.Buffer;try{globalThis.Buffer=undefined;result=await browserTrainingArchive(manifest,[...files].reverse(),{includeSensitiveOriginals:true,expectedSha256:pin.toUpperCase()});}finally{globalThis.Buffer=previous;}
  expect(result.archiveDigest).toBe(hash(result.bytes));expect(result.digest).toBe(pin);expect(result.fileCount).toBe(7);expect(result.bundleCount).toBe(3);
  const items=entries(result.bytes),byName=new Map(items);expect([...byName.keys()]).toEqual(['training/training.json','training/case.json','training/notebook.json','training/paired.json','reports/intake-report.html','reports/validation.json','reports/READ-ME.txt']);
  expect(byName.get('training/training.json')).toEqual(await manifest.arrayBuffer());for(const f of files)expect(byName.get('training/'+f.name)).toEqual(await f.arrayBuffer());
  const extracted=join(dir,'extracted');await import('node:fs/promises').then(m=>m.mkdir(extracted));for(const [name,bytes]of items.filter(([name])=>name.startsWith('training/')))await writeFile(join(extracted,name.slice(9)),bytes);
  const checked=await verifyTrainingManifest(join(extracted,'training.json'),{expectedSha256:pin});expect(checked.bundle_count).toBe(3);expect(result.html).toBe(await reportTrainingIntake(join(extracted,'training.json'),{expectedSha256:pin}));expect(byName.get('reports/intake-report.html').toString()).toBe(result.html);
  expect(byName.get('reports/READ-ME.txt').toString()).toBe(browserArchiveGuide);expect(browserArchiveGuide).toContain('unencrypted');expect(browserArchiveGuide).toContain('No conversion lineage');
  const receipt=JSON.parse(byName.get('reports/validation.json'));expect(receipt.exact_manifest_sha256).toBe(pin);expect(receipt.expected_manifest_digest_matched).toBe(true);expect(receipt.scope).toContain('not imported evidence');
});
it('distinguishes generated pins from independent expectations and rejects saved receipts, bad pins, wrong kind, missing/extra/duplicate files',async()=>{
  const options={includeSensitiveOriginals:true};const success=await browserTrainingArchive(manifest,files,options);expect(JSON.parse(new Map(entries(success.bytes)).get('reports/validation.json')).expected_manifest_digest_matched).toBe(false);
  for(const f of files)f.arrayBuffer.mockClear();await expect(browserTrainingArchive(manifest,files,{...options,expectedSha256:'a'.repeat(64)})).rejects.toThrow();for(const f of files)expect(f.arrayBuffer).not.toHaveBeenCalled();
  for(const selection of [files.slice(1),[...files,file('extra.json',Buffer.from('{}'))],[files[0],files[0],files[2]]])await expect(browserTrainingArchive(manifest,selection,options)).rejects.toThrow();
  await expect(browserTrainingArchive(file('receipt.json',Buffer.from('{"format":"skydash-training-intake-receipt-v2"}')),files,options)).rejects.toThrow();await alter('training.json',{kind:'paired'});await expect(browserTrainingArchive(manifest,files,options)).rejects.toThrow();
});
it('repins the manifest and every copied original after nested validation, with no partial archive',async()=>{
  const original=manifest.arrayBuffer;manifest.arrayBuffer=vi.fn().mockImplementationOnce(original).mockImplementationOnce(original).mockResolvedValue(Buffer.from('{}'));await expect(browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true})).rejects.toThrow('Changed manifest');
  manifest.arrayBuffer=original;const read=files[2].arrayBuffer;files[2].arrayBuffer=vi.fn().mockImplementationOnce(read).mockImplementationOnce(read).mockResolvedValue(Buffer.from('{}'));await expect(browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true})).rejects.toThrow('Changed original');
});
it('refuses unsafe original or manifest archive names rather than renaming sensitive files',async()=>{
  for(const name of ['../training.json','CON.json','bad?.json','reports/../../escape','training.json.'])await expect(browserTrainingArchive({...manifest,name},files,{includeSensitiveOriginals:true})).rejects.toThrow();
  await alter('training.json',{path:'CON.json'});files[0]={...files[0],name:'CON.json'};await expect(browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true})).rejects.toThrow('safe relative');
});
it('shared ZIP encoder keeps CLI bytes identical and refuses portable-name collisions and traversal',()=>{
  const sample=[['training/é.json',new Uint8Array([0,255,80])],['reports/note.txt','fixed']];expect(hash(storedZipBytes(sample))).toBe('e767ce7ddcc525077e0d65259198f5a8c18e204d6fe571f2c58fdcd43c1f35ae');expect(Buffer.from(storedZipBytes(sample))).toEqual(storedZip(sample));entries(storedZipBytes(sample));
  for(const names of [['a','A'],['é','e\u0301'],['a','a/b'],['../a'],['/a'],['a\\b'],['COM1.json'],['a:bad'],['a.'],['a '],[''],['bad\u0000.json']])expect(()=>storedZipBytes(names.map(name=>[name,new Uint8Array()]))).toThrow();
});

it.each([
  ['oversized manifest',65537,null],['negative manifest',-1,null],['fractional manifest',1.5,null],
  ['case over2MiB',null,2*1024*1024+1],['negative artifact',null,-1],['fractional artifact',null,1.5],
])('refuses %s from declared bounds before original reads',async(_name,manifestSize,artifactSize)=>{
  if(manifestSize!==null)manifest={...manifest,size:manifestSize};if(artifactSize!==null)files[0]={...files[0],size:artifactSize};
  await expect(browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true})).rejects.toThrow();for(const f of files)expect(f.arrayBuffer).not.toHaveBeenCalled();
});
it('refuses source-hash-invalid originals even after a new complete-file digest and archive count limits',async()=>{
  const changed=JSON.parse(await files[0].arrayBuffer());changed.source.sha256='a'.repeat(64);const bytes=Buffer.from(JSON.stringify(changed));files[0]=file(files[0].name,bytes);await alter('training.json',{sha256:hash(bytes)});await expect(browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true})).rejects.toThrow();
  await expect(browserTrainingArchive(manifest,Array.from({length:21},()=>files[0]),{includeSensitiveOriginals:true})).rejects.toThrow();
});
