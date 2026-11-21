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
  expect(result.html).toBe(await reportTrainingIntake(join(dir,'kit','training.json'),{expectedSha256:options.expectedManifestSha256}));expect(result.archiveDigest).toBe(hash(archive.bytes));expect(result.expectedArchiveDigestMatched).toBe(true);expect(result.expectedManifestDigestMatched).toBe(true);expect(result.bundleCount).toBe(3);expect(result.fileCount).toBe(7);expect(input.arrayBuffer).toHaveBeenCalledTimes(1);
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
