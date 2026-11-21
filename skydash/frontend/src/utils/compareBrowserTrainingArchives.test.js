import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { webcrypto,createHash } from 'node:crypto';
import { mkdtemp,readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browserTrainingArchive } from './browserTrainingArchive';
import { compareBrowserTrainingArchives } from './checkBrowserTrainingArchive';
import { storedZipBytes } from './storedZip';
import { createTrainingExample } from '../../scripts/create-training-example.mjs';
import { reportTrainingComparison } from '../../scripts/report-training-comparison.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=(name,bytes)=>({name,size:bytes.length,arrayBuffer:vi.fn(async()=>bytes)});
function unpack(bytes){const b=Buffer.from(bytes),out=[];let pos=0;while(b.readUInt32LE(pos)===0x04034b50){const size=b.readUInt32LE(pos+22),length=b.readUInt16LE(pos+26),start=pos+30+length;out.push([b.subarray(pos+30,start).toString(),b.subarray(start,start+size)]);pos=start+size;}return out;}
const side=(bytes,options={})=>({file:file('PRIVATE.zip',bytes),options});
let dir,archive,parts,manifest;
beforeEach(async()=>{vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-zip-comparison-'));const root=join(dir,'kit');await createTrainingExample(root);manifest=file('training.json',await readFile(join(root,'training.json')));const files=await Promise.all(['case','notebook','paired'].map(async kind=>file(kind+'.json',await readFile(join(root,kind+'.json')))));archive=await browserTrainingArchive(manifest,files,{includeSensitiveOriginals:true});parts=unpack(archive.bytes);});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('both independent ZIP and manifest pins preserve original CLI comparison bytes, no Buffer or private-original exposure',async()=>{
  const options={expectedArchiveSha256:hash(archive.bytes).toUpperCase(),expectedManifestSha256:hash(parts[0][1]).toUpperCase()},left=side(archive.bytes,options),right=side(archive.bytes);let result;const previous=globalThis.Buffer;try{globalThis.Buffer=undefined;result=await compareBrowserTrainingArchives(left,right);}finally{globalThis.Buffer=previous;}
  const original=join(dir,'kit','training.json');expect(result.html).toBe(await reportTrainingComparison(original,original,{expectedLeftSha256:options.expectedManifestSha256}));expect(result.left).toEqual({archiveDigest:hash(archive.bytes),manifestDigest:hash(parts[0][1]),expectedArchiveDigestMatched:true,expectedManifestDigestMatched:true});expect(result.right.expectedArchiveDigestMatched).toBe(false);expect(result.right.expectedManifestDigestMatched).toBe(false);expect(left.file.arrayBuffer).toHaveBeenCalledTimes(1);expect(right.file.arrayBuffer).toHaveBeenCalledTimes(1);expect(Object.keys(result)).toEqual(['html','leftDigest','rightDigest','left','right']);expect(result).not.toHaveProperty('files');expect(result.html).not.toMatch(/<script|<img|<iframe|<link|PRIVATE/);
});
it('different saved inert report/receipt bytes change only whole-ZIP fingerprint, not original comparison',async()=>{
  const expected=await compareBrowserTrainingArchives(side(archive.bytes),side(archive.bytes));parts[4][1]=Buffer.from('<script>PRIVATE FAKE REPORT</script>');parts[5][1]=Buffer.from('PRIVATE NOT JSON');const changed=storedZipBytes(parts),result=await compareBrowserTrainingArchives(side(archive.bytes),side(changed));expect(result.html).toBe(expected.html);expect(result.left.archiveDigest).not.toBe(result.right.archiveDigest);expect(result.left.manifestDigest).toBe(result.right.manifestDigest);expect(result.html).not.toContain('PRIVATE');
});
it('same archive filenames remain separate; changed original bytes with equal CSVs differ as artifacts, not guessed edits',async()=>{
  const declaration=JSON.parse(parts[0][1]);parts[1][1]=Buffer.concat([parts[1][1],Buffer.from(' ')]);declaration.bundles[0].sha256=hash(parts[1][1]);parts[0][1]=Buffer.from(JSON.stringify(declaration));const target=join(dir,'right');await mkdir(target);for(const [name,bytes] of parts.slice(0,4))await writeFile(join(target,name.slice(9)),bytes);const result=await compareBrowserTrainingArchives(side(archive.bytes),side(storedZipBytes(parts)));expect(result.html).toBe(await reportTrainingComparison(join(dir,'kit','training.json'),join(target,'training.json')));expect(result.html).toContain('CSV source occurrence inventory: equal');expect(result.html).toContain('Complete-artifact occurrence inventory: different');expect(result.html).toContain('not proof of added or deleted work');
});
it('reordered whole artifacts and repeated source roles preserve ordinals and multiplicity instead of pairing or deduplicating',async()=>{
  const declaration=JSON.parse(parts[0][1]);declaration.bundles.reverse();const reversed=[[parts[0][0],Buffer.from(JSON.stringify(declaration))],...parts.slice(1,4).reverse(),...parts.slice(4)];const result=await compareBrowserTrainingArchives(side(archive.bytes),side(storedZipBytes(reversed)));for(const text of ['Ordered complete-artifact sequence: different','Complete-artifact occurrence inventory: equal','CSV source occurrence inventory: equal','paired / baseline','paired / primary'])expect(result.html).toContain(text);
});
it('each side refuses invalid pins, unsupported ZIP encoding, changed size and late nested invalidity without partial comparison',async()=>{
  for(const position of [0,1]){for(const options of [{expectedArchiveSha256:'a'.repeat(64)},{expectedManifestSha256:'a'.repeat(64)},{expectedArchiveSha256:'bad'}]){const sides=[side(archive.bytes),side(archive.bytes)];sides[position].options=options;await expect(compareBrowserTrainingArchives(...sides)).rejects.toThrow();}const bytes=Uint8Array.from(archive.bytes);bytes[8]=8;const sides=[side(archive.bytes),side(archive.bytes)];sides[position]=side(bytes);await expect(compareBrowserTrainingArchives(...sides)).rejects.toThrow();}
  const invalid=JSON.parse(parts[3][1]);invalid.comparison.baseline.sha256='a'.repeat(64);parts[3][1]=Buffer.from(JSON.stringify(invalid));const declaration=JSON.parse(parts[0][1]);declaration.bundles[2].sha256=hash(parts[3][1]);parts[0][1]=Buffer.from(JSON.stringify(declaration));await expect(compareBrowserTrainingArchives(side(archive.bytes),side(storedZipBytes(parts)))).rejects.toThrow();await expect(compareBrowserTrainingArchives(side(archive.bytes),null)).rejects.toThrow();
});
