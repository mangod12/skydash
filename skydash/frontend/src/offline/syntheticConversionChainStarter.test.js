import {webcrypto} from 'node:crypto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {syntheticConversionChainStarter,SYNTHETIC_CHAIN_GUIDE} from './syntheticConversionChainStarter';
import {checkReceivedConversionChain} from './receivedConversionChain';
const file=bytes=>({size:bytes.byteLength,arrayBuffer:async()=>bytes.slice().buffer});
const consent={confirmedNominal:true,confirmedWGS84:true};
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));
afterEach(()=>vi.unstubAllGlobals());
it('accepts no caller input, including an undefined argument',async()=>{
 for(const input of [undefined,null,{},new Uint8Array([1])])await expect(syntheticConversionChainStarter(input)).rejects.toThrow(/no inputs/);
});
it('prepares two matching complete chains and one structurally intact but nonmatching final, checked by the current receiver',async()=>{
 const result=await syntheticConversionChainStarter();
 expect(result).toMatchObject({format:'skydash-fabricated-conversion-chain-starter-v1',synthetic_only:true,guide:SYNTHETIC_CHAIN_GUIDE});
 expect(result.archives.map(value=>[value.key,value.expectedOutcome,value.fileCount])).toEqual([['match-a','match',7],['match-b','match',7],['bad-final','refuse',7]]);
 for(const archive of result.archives){
  expect(archive.filename).toMatch(/^skydash-fabricated-chain-[a-z-]+\.zip$/);
  expect(archive.archiveDigest).toMatch(/^[a-f0-9]{64}$/);
  const actual=Buffer.from(await webcrypto.subtle.digest('SHA-256',archive.bytes)).toString('hex');
  expect(archive.archiveDigest).toBe(actual);
  if(archive.expectedOutcome==='refuse')await expect(checkReceivedConversionChain(file(archive.bytes),consent)).rejects.toThrow(/exactly reproduce/);
  else{
   const checked=await checkReceivedConversionChain(file(archive.bytes),consent);
   expect(checked.original_chain.timestamp).toMatchObject({original_rows:3,intermediate_columns:4,nominal_duration:'12'});
   expect(checked.original_chain.numeric.converted_samples).toBe(3);
   expect(checked.expected_archive_digest_matched).toBe(false);
   expect(Object.values(checked.original_chain.expected_raw_digests_matched)).toEqual([false,false,false,false,false]);
  }
 }
 expect(result.archives[0].archiveDigest).not.toBe(result.archives[1].archiveDigest);
});
it('is byte reproducible and a returned buffer edit cannot change later generated examples',async()=>{
 const first=await syntheticConversionChainStarter(),second=await syntheticConversionChainStarter();
 for(let i=0;i<3;i++){expect(first.archives[i].bytes).toEqual(second.archives[i].bytes);expect(first.archives[i].archiveDigest).toBe(second.archives[i].archiveDigest);}
 first.archives[0].bytes.fill(0);
 const third=await syntheticConversionChainStarter();expect(third.archives[0].bytes).toEqual(second.archives[0].bytes);
});
it('does not turn generator self-checks into recipient interpretation statements',async()=>{
 const result=await syntheticConversionChainStarter();
 for(const archive of result.archives){
  const read=vi.fn(async()=>archive.bytes.slice().buffer);
  await expect(checkReceivedConversionChain({size:archive.bytes.byteLength,arrayBuffer:read})).rejects.toThrow(/fresh interpretation/);
  expect(read).not.toHaveBeenCalled();
 }
 expect(result.guide).toContain("does not supply a recipient's fresh statements");
 expect(result.guide).toContain('not independent flights');
 expect(result.guide).toContain('not independent authentication');
});
