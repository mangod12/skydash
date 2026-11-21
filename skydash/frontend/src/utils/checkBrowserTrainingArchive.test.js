import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { webcrypto,createHash } from 'node:crypto';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browserTrainingArchive } from './browserTrainingArchive';
import { checkBrowserTrainingArchive } from './checkBrowserTrainingArchive';
import { storedZipBytes } from './storedZip';
import { createTrainingExample } from '../../scripts/create-training-example.mjs';
import { reportTrainingIntake } from '../../scripts/report-training-intake.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=(name,bytes)=>({name,size:bytes.length,arrayBuffer:vi.fn(async()=>bytes)});
let dir,manifest,files,archive,parts;
function unpack(bytes){const b=Buffer.from(bytes),out=[];let pos=0;while(b.readUInt32LE(pos)===0x04034b50){const size=b.readUInt32LE(pos+22),length=b.readUInt16LE(pos+26),start=pos+30+length;out.push([b.subarray(pos+30,start).toString(),b.subarray(start,start+size)]);pos=start+size;}return out;}
const packed=entries=>file('PRIVATE.zip',storedZipBytes(entries));
beforeEach(async()=>{
  vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-received-zip-'));const root=join(dir,'kit');await createTrainingExample(root);manifest=file('training.json',await readFile(join(root,'training.json')));files=await Promise.all(['case.json','notebook.json','paired.json'].map(async name=>file(name,await readFile(join(root,name)))));archive=await browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true});parts=unpack(archive.bytes);
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('checks whole archive and original manifest independently before fresh nested validation without Buffer, yielding actual CLI HTML',async()=>{
  const options={expectedArchiveSha256:hash(archive.bytes).toUpperCase(),expectedManifestSha256:hash(await manifest.arrayBuffer()).toUpperCase()};const input=file('PRIVATE.zip',archive.bytes);let result;const old=globalThis.Buffer;try{globalThis.Buffer=undefined;result=await checkBrowserTrainingArchive(input,options);}finally{globalThis.Buffer=old;}
  expect(result.html).toBe(await reportTrainingIntake(join(dir,'kit','training.json'),{expectedSha256:options.expectedManifestSha256}));expect(result.archiveDigest).toBe(hash(archive.bytes));expect(result.expectedArchiveDigestMatched).toBe(true);expect(result.expectedManifestDigestMatched).toBe(true);expect(result.bundleCount).toBe(3);expect(result.fileCount).toBe(7);expect(result.originals).toEqual(JSON.parse(Buffer.from(await manifest.arrayBuffer()).toString()).bundles.map((item,index)=>({ordinal:index+1,kind:item.kind,sha256:item.sha256})));for(const item of result.originals)expect(Object.keys(item)).toEqual(['ordinal','kind','sha256']);expect(input.arrayBuffer).toHaveBeenCalledTimes(1);
});
it('treats saved reports and receipts as inert untrusted bytes, regenerates from actual originals and labels missing independent expectations',async()=>{
  parts[4][1]=Buffer.from('<script>PRIVATE untrusted fake report</script>');parts[5][1]=Buffer.from('not JSON, fake success, PRIVATE');const result=await checkBrowserTrainingArchive(packed(parts));expect(result.html).not.toContain('PRIVATE');expect(result.html).not.toContain('<script');expect(result.html).toBe(archive.html);expect(result.expectedArchiveDigestMatched).toBe(false);expect(result.expectedManifestDigestMatched).toBe(false);
});
it('whole-ZIP mismatch refuses before malformed ZIP parsing; manifest expectation checked before parsing manifest paths',async()=>{
  await expect(checkBrowserTrainingArchive(file('bad.zip',new Uint8Array(40)),{expectedArchiveSha256:'a'.repeat(64)})).rejects.toThrow('archive expectation');parts[0][1]=Buffer.from('not JSON');await expect(checkBrowserTrainingArchive(packed(parts),{expectedManifestSha256:'a'.repeat(64)})).rejects.toThrow('manifest expectation');
});
it.each([0,4,6,8,10,12,14,18,22,26,28])('refuses changed local header byte at%d without accepting a report',async offset=>{const bytes=Uint8Array.from(archive.bytes);bytes[offset]^=1;await expect(checkBrowserTrainingArchive(file('bad.zip',bytes))).rejects.toThrow();});
it('refuses central-directory changes, trailing data, truncation and unsupported compressed/ZIP64/comment layouts',async()=>{
  for(const offset of [archive.bytes.length-1,archive.bytes.length-4,archive.bytes.length-22,archive.bytes.length-30]){const bytes=Uint8Array.from(archive.bytes);bytes[offset]^=1;await expect(checkBrowserTrainingArchive(file('bad.zip',bytes))).rejects.toThrow();}
  for(const bytes of [archive.bytes.slice(0,-1),new Uint8Array([...archive.bytes,0]),archive.bytes.slice(0,40)])await expect(checkBrowserTrainingArchive(file('bad.zip',bytes))).rejects.toThrow();
});
it('refuses extra/missing/reordered entries, source folder paths, invalid guide and exact duplicate aliases',async()=>{
  for(const entries of [parts.slice(1),[...parts,['extra.txt',Buffer.from('x')]],[parts[0],parts[2],parts[1],...parts.slice(3)],[...parts.slice(0,-1),['reports/READ-ME.txt',Buffer.from('other guide')]],[[parts[0][0].replace('training.json','folder/training.json'),parts[0][1]],...parts.slice(1)]])await expect(checkBrowserTrainingArchive(packed(entries))).rejects.toThrow();
  expect(()=>packed([...parts,parts[0]])).toThrow();
});
it('refuses nested-invalid sources and wrong artifact pins even with internally consistent ZIP CRCs and newly updated file pins',async()=>{
  const bad=JSON.parse(parts[1][1]);bad.source.sha256='a'.repeat(64);parts[1][1]=Buffer.from(JSON.stringify(bad));await expect(checkBrowserTrainingArchive(packed(parts))).rejects.toThrow();const declaration=JSON.parse(parts[0][1]);declaration.bundles[0].sha256=hash(parts[1][1]);parts[0][1]=Buffer.from(JSON.stringify(declaration));await expect(checkBrowserTrainingArchive(packed(parts))).rejects.toThrow();
});
it.each([21,30*1024*1024+1,-1,1.5])('refuses declared archive size%d before reads',async size=>{const input={...file('bad.zip',archive.bytes),size};await expect(checkBrowserTrainingArchive(input)).rejects.toThrow();expect(input.arrayBuffer).not.toHaveBeenCalled();});
it('refuses changed byte counts and malformed expectations before reading',async()=>{
  const input=file('bad.zip',archive.bytes);for(const options of [{expectedArchiveSha256:'wrong'},{expectedManifestSha256:null},{expectedArchiveSha256:123}])await expect(checkBrowserTrainingArchive(input,options)).rejects.toThrow();expect(input.arrayBuffer).not.toHaveBeenCalled();await expect(checkBrowserTrainingArchive({...input,size:input.size+1})).rejects.toThrow('Changed archive');
});
it('private received packet requires strict acknowledgement before archive reads and default check never exposes originals or private HTML',async()=>{
  const {privateBrowserTrainingArchive}=await import('./checkBrowserTrainingArchive');const input=file('PRIVATE.zip',archive.bytes);
  for(const includePrivateReview of [undefined,false,1,'true'])await expect(privateBrowserTrainingArchive(input,{includePrivateReview})).rejects.toThrow('Explicit private');
  expect(input.arrayBuffer).not.toHaveBeenCalled();const result=await checkBrowserTrainingArchive(input);expect(Object.keys(result)).toEqual(['html','digest','archiveDigest','expectedArchiveDigestMatched','expectedManifestDigestMatched','fileCount','bundleCount','originals']);
});
it('private ZIP packet is freshly derived from all originals, CLI-identical with independent manifest pin and no Buffer',async()=>{
  const {privateBrowserTrainingArchive}=await import('./checkBrowserTrainingArchive');const {reportPrivateTraining}=await import('../../scripts/report-private-training.mjs');const options={includePrivateReview:true,expectedArchiveSha256:hash(archive.bytes).toUpperCase(),expectedManifestSha256:hash(await manifest.arrayBuffer()).toUpperCase()};const input=file('PRIVATE.zip',archive.bytes);let result;const previous=globalThis.Buffer;try{globalThis.Buffer=undefined;result=await privateBrowserTrainingArchive(input,options);}finally{globalThis.Buffer=previous;}
  expect(result.privateHtml).toBe(await reportPrivateTraining(join(dir,'kit','training.json'),{includePrivateReview:true,expectedSha256:options.expectedManifestSha256}));expect(result.html).toBe(await reportTrainingIntake(join(dir,'kit','training.json'),{expectedSha256:options.expectedManifestSha256}));expect(input.arrayBuffer).toHaveBeenCalledTimes(1);expect(result.expectedArchiveDigestMatched).toBe(true);expect(result.privateHtml).not.toMatch(/<script|<iframe|<img|<link/i);for(const word of ['Bundle 1: case','Bundle 2: notebook','Bundle 3: paired','SYNTHETIC'])expect(result.privateHtml).toContain(word);expect(result).not.toHaveProperty('files');expect(result).not.toHaveProperty('manifest');
});
it('selected ZIP private packet prints only explicit original ordinals, fresh full intake and CLI-identical subset after all-original validation',async()=>{
  const {privateBrowserTrainingArchive}=await import('./checkBrowserTrainingArchive'),{reportPrivateTraining}=await import('../../scripts/report-private-training.mjs');const input=file('PRIVATE.zip',archive.bytes);
  for(const selectedOrdinals of [[],[1,1],[21]])await expect(privateBrowserTrainingArchive(input,{includePrivateReview:true,selectedOrdinals})).rejects.toThrow();expect(input.arrayBuffer).not.toHaveBeenCalled();
  const options={includePrivateReview:true,selectedOrdinals:[3,1],expectedArchiveSha256:hash(archive.bytes),expectedManifestSha256:hash(await manifest.arrayBuffer())};const pending=privateBrowserTrainingArchive(input,options);options.selectedOrdinals.splice(0,2,2);const result=await pending;expect(result.privateOrdinals).toEqual([1,3]);expect(result.bundleCount).toBe(3);expect(result.privateHtml).toBe(await reportPrivateTraining(join(dir,'kit','training.json'),{includePrivateReview:true,selectedOrdinals:[1,3],expectedSha256:options.expectedManifestSha256}));expect(result.html).toBe(await reportTrainingIntake(join(dir,'kit','training.json'),{expectedSha256:options.expectedManifestSha256}));expect(result.privateHtml).not.toContain('Bundle 2: notebook');expect(result.privateHtml).not.toContain('Bundle 2 source');expect(result.privateHtml).toContain('Explicit subset: 2 of 3');await expect(privateBrowserTrainingArchive(input,{includePrivateReview:true,selectedOrdinals:[4]})).rejects.toThrow();
  const bad=JSON.parse(parts[3][1]);bad.comparison.baseline.sha256='a'.repeat(64);parts[3][1]=Buffer.from(JSON.stringify(bad));const declaration=JSON.parse(parts[0][1]);declaration.bundles[2].sha256=hash(parts[3][1]);parts[0][1]=Buffer.from(JSON.stringify(declaration));await expect(privateBrowserTrainingArchive(packed(parts),{includePrivateReview:true,selectedOrdinals:[1]})).rejects.toThrow();
});
it('one explicitly acknowledged original is byteidentical, with full ZIP validation and honest separate artifact expectation',async()=>{
 const {selectedBrowserTrainingArchiveOriginal:choose}=await import('./checkBrowserTrainingArchive');const input=file('PRIVATE.zip',archive.bytes);
 for(const options of [{},{includeSensitiveOriginal:1,ordinal:1},{includeSensitiveOriginal:true,ordinal:0},{includeSensitiveOriginal:true,ordinal:'1'},{includeSensitiveOriginal:true,ordinal:21},{includeSensitiveOriginal:true,ordinal:1,expectedArtifactSha256:'bad'}])await expect(choose(input,options)).rejects.toThrow();expect(input.arrayBuffer).not.toHaveBeenCalled();
 for(let ordinal=1;ordinal<=3;ordinal++){
  const r=await choose(input,{includeSensitiveOriginal:true,ordinal,expectedArchiveSha256:hash(archive.bytes),expectedManifestSha256:hash(await manifest.arrayBuffer()),expectedArtifactSha256:hash(parts[ordinal][1]).toUpperCase()});expect(Buffer.from(r.bytes)).toEqual(parts[ordinal][1]);expect(r.kind).toBe(['case','notebook','paired'][ordinal-1]);expect(r.ordinal).toBe(ordinal);expect(r.expectedArtifactDigestMatched).toBe(true);expect(r.artifactDigest).toBe(hash(parts[ordinal][1]));expect(Object.keys(r)).toEqual(['bytes','kind','ordinal','bundleCount','artifactDigest','expectedArtifactDigestMatched','archiveDigest','manifestDigest']);
 }
 expect((await choose(input,{includeSensitiveOriginal:true,ordinal:1})).expectedArtifactDigestMatched).toBe(false);for(const options of [{ordinal:4},{ordinal:1,expectedArtifactSha256:'a'.repeat(64)},{ordinal:1,expectedArchiveSha256:'a'.repeat(64)},{ordinal:1,expectedManifestSha256:'a'.repeat(64)}])await expect(choose(input,{includeSensitiveOriginal:true,...options})).rejects.toThrow();
 const malformed=parts.map(([name,bytes])=>[name,bytes]);malformed[1]=[parts[1][0],Buffer.from('malformed selected original')];await expect(choose(packed(malformed),{includeSensitiveOriginal:true,ordinal:1,expectedArtifactSha256:'a'.repeat(64)})).rejects.toThrow('Selected complete-original expectation mismatch');
 const bad=JSON.parse(parts[3][1]);bad.comparison.baseline.sha256='a'.repeat(64);parts[3][1]=Buffer.from(JSON.stringify(bad));const declaration=JSON.parse(parts[0][1]);declaration.bundles[2].sha256=hash(parts[3][1]);parts[0][1]=Buffer.from(JSON.stringify(declaration));await expect(choose(packed(parts),{includeSensitiveOriginal:true,ordinal:1})).rejects.toThrow();
});
it('private ZIP ignores saved report and receipt instructions and freshly revalidates late nested originals and both independent pins',async()=>{
  const {privateBrowserTrainingArchive}=await import('./checkBrowserTrainingArchive');const options={includePrivateReview:true};const expected=await privateBrowserTrainingArchive(packed(parts),options);parts[4][1]=Buffer.from('<script>UNTRUSTED RECEIVED REPORT</script>');parts[5][1]=Buffer.from('UNTRUSTED RECEIVED RECEIPT');const result=await privateBrowserTrainingArchive(packed(parts),options);expect(result.privateHtml).toBe(expected.privateHtml);expect(result.html).toBe(expected.html);expect(result.privateHtml).not.toContain('UNTRUSTED');
  for(const opts of [{expectedArchiveSha256:'a'.repeat(64)},{expectedManifestSha256:'a'.repeat(64)},{expectedManifestSha256:'invalid'}])await expect(privateBrowserTrainingArchive(packed(parts),{...options,...opts})).rejects.toThrow();
  const bad=JSON.parse(parts[3][1]);bad.comparison.baseline.sha256='a'.repeat(64);parts[3][1]=Buffer.from(JSON.stringify(bad));const declaration=JSON.parse(parts[0][1]);declaration.bundles[2].sha256=hash(parts[3][1]);parts[0][1]=Buffer.from(JSON.stringify(declaration));await expect(privateBrowserTrainingArchive(packed(parts),options)).rejects.toThrow();
});
