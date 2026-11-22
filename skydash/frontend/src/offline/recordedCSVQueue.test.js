import {webcrypto} from 'node:crypto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {LOG_HEADER} from '../utils/flightLog';
import {checkRecordedCSVQueue,describeRecordedCSVQueueSelection} from './recordedCSVQueue';
const raw=LOG_HEADER+'\n0,28,77,10,,95\n4,28.1,77.1,,,94\n12,28.2,77.2,12,4,\n';
const file=(text=raw,name='unverified.csv')=>{const bytes=typeof text==='string'?new TextEncoder().encode(text):text;return{name,size:bytes.byteLength,arrayBuffer:vi.fn(async()=>bytes.slice().buffer)};};
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));afterEach(()=>vi.unstubAllGlobals());
it('describes a batch without reading and preserves selection order, full source, exact hashes, missing cells and source intervals',async()=>{
 const files=[file(raw,'first.csv'),file(raw.replace('12,28.2','13,28.2'),'second.csv')];expect(describeRecordedCSVQueueSelection(files)).toEqual({files:2,bytes:files[0].size+files[1].size});for(const value of files)expect(value.arrayBuffer).not.toHaveBeenCalled();
 const result=await checkRecordedCSVQueue(files);expect(result.ready_files).toBe(2);expect(result.entries.map(value=>value.filename)).toEqual(['first.csv','second.csv']);
 expect(result.entries[0]).toMatchObject({slot:1,status:'ready',csv_text:raw,sample_count:3,source_span_s:12,gaps_over_5s:1,largest_source_interval_s:8,missing_cells:{altitude_m:1,ground_speed_m_s:2,battery_pct:1},same_bytes_as_slots:[]});expect(result.entries[1].source_span_s).toBe(13);
 for(const entry of result.entries)expect(entry.sha256).toBe(Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(entry.csv_text))).toString('hex'));
});
it('identifies equal bytes by slots without combining names, sorting, dropping duplicates or inventing flight identity',async()=>{
 const result=await checkRecordedCSVQueue([file(raw,'z.csv'),file(raw.replace(',95',',96'),'a.csv'),file(raw,'z.csv')]);expect(result.entries.map(entry=>entry.slot)).toEqual([1,2,3]);expect(result.entries.map(entry=>entry.same_bytes_as_slots)).toEqual([[3],[],[1]]);expect(result.ready_files).toBe(3);
});
it('validates the entire batch metadata before any read, including final item and total bytes',async()=>{
 for(const mutate of [files=>files.push({...file(),size:1048577}),files=>files.push({...file(),arrayBuffer:null}),files=>files.push({...file(),size:0}),files=>files.push(...Array.from({length:8},()=>file())),files=>files.push(...Array.from({length:4},()=>({...file(),size:1048576})))]){
  const files=[file()];mutate(files);await expect(checkRecordedCSVQueue(files)).rejects.toThrow();for(const value of files)if(vi.isMockFunction(value.arrayBuffer))expect(value.arrayBuffer).not.toHaveBeenCalled();
 }
 await expect(checkRecordedCSVQueue([])).rejects.toThrow();await expect(checkRecordedCSVQueue(null)).rejects.toThrow();
});
it('isolates unreadable, size-changed, invalid UTF-8 and unsupported entries without exposing private diagnostics or partial source',async()=>{
 const unreadable=file();unreadable.arrayBuffer.mockRejectedValueOnce(Error('SECRET diagnostic'));
 const changed=file();changed.size++;
 const result=await checkRecordedCSVQueue([file(),unreadable,changed,file(new Uint8Array([255])),file('SECRET not a native CSV')]);expect(result.ready_files).toBe(1);expect(result.entries.slice(1).map(entry=>entry.status)).toEqual(Array(4).fill('not-prepared'));for(const entry of result.entries.slice(1))expect(Object.keys(entry).sort()).toEqual(['filename','slot','status']);expect(JSON.stringify(result)).not.toContain('SECRET');
});
it('preserves UTF-8 BOM and CRLF in captured text and raw fingerprint rather than normalizing source bytes',async()=>{
 const text='\uFEFF'+raw.replaceAll('\n','\r\n'),result=await checkRecordedCSVQueue([file(text)]),entry=result.entries[0];expect(entry.csv_text).toBe(text);expect(entry.sha256).toBe(Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex'));expect(entry.bytes).toBe(new TextEncoder().encode(text).length);
});
it('captures every later handle, method, size and displayed filename before awaiting the first read',async()=>{
 const files=[file(),file(raw,'captured.csv')],later=files[1],read=later.arrayBuffer;let resolve;const bytes=new TextEncoder().encode(raw);files[0].arrayBuffer=()=>new Promise(done=>{resolve=done;});const pending=checkRecordedCSVQueue(files);later.name='changed.csv';later.size=1;later.arrayBuffer=()=>{throw Error('changed method');};files[1]=file('unsupported');resolve(bytes.buffer);const result=await pending;expect(result.ready_files).toBe(2);expect(result.entries[1].filename).toBe('captured.csv');expect(read).toHaveBeenCalledTimes(1);
});
it('returns independently owned strings/results and captures bounded unverified filenames without coercing objects',async()=>{
 const first=await checkRecordedCSVQueue([file(raw,'<img src=x onerror=alert(1)>'.repeat(10)),file(raw,{toString:()=>{throw Error('not called');}})]);expect(first.entries[0].filename.length).toBe(120);expect(first.entries[1].filename).toBe('unnamed.csv');first.entries[0].csv_text='changed';expect((await checkRecordedCSVQueue([file()])).entries[0].csv_text).toBe(raw);
});
