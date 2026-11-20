import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { webcrypto,createHash } from 'node:crypto';
import { readReviewArtifact } from './reviewArtifact';
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));
afterEach(()=>vi.unstubAllGlobals());
const file=bytes=>({size:bytes.length,arrayBuffer:vi.fn(async()=>Uint8Array.from(bytes).buffer)});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
it('pins exact raw bytes including BOM/CRLF/multibyte text, accepts uppercase and distinguishes no expected digest',async()=>{
 const bytes=Buffer.from('\ufeff{"note":"讨论"}\r\n'),input=file(bytes),data=await readReviewArtifact(input,1024,hash(bytes).toUpperCase());expect(data.sha256).toBe(hash(bytes));expect(data.text).toBe(bytes.toString());expect(data.expectedMatched).toBe(true);expect((await readReviewArtifact(input,1024)).expectedMatched).toBe(false);await expect(readReviewArtifact(file(Buffer.from(bytes.toString()+' ')),1024,hash(bytes))).rejects.toThrow('mismatch');
});
it('rejects malformed expected digests before file reads and declared/actual oversize before decoding',async()=>{
 const input=file(Buffer.from('{}'));for(const bad of ['a','g'.repeat(64),'a'.repeat(65)])await expect(readReviewArtifact(input,10,bad)).rejects.toThrow('64hexadecimal');expect(input.arrayBuffer).not.toHaveBeenCalled();await expect(readReviewArtifact(input,1)).rejects.toThrow('limit');expect(input.arrayBuffer).not.toHaveBeenCalled();await expect(readReviewArtifact({...input,size:1},1)).rejects.toThrow('limit');
});
it('compares expected digest before decoding invalid UTF-8 and never silently repairs it',async()=>{
 const bytes=Buffer.from([0xff]);await expect(readReviewArtifact(file(bytes),10,'a'.repeat(64))).rejects.toThrow('mismatch');await expect(readReviewArtifact(file(bytes),10,hash(bytes))).rejects.toThrow();
});
