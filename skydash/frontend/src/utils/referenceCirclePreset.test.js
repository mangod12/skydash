import { describe,expect,it } from 'vitest';
import { referenceCirclePreset,readReferenceCirclePreset } from './referenceCirclePreset';
const criteria={latitude:28.6139,longitude:77.209,radiusM:40,label:'Training reference',notes:'Private unverified notes'};
const value=()=>referenceCirclePreset(criteria),read=data=>readReferenceCirclePreset(JSON.stringify(data));
describe('reusable reference circle preset',()=>{
 it('roundtrips reviewed criteria without source/results/confirmation and does not alias or mutate criteria',()=>{const data=value();expect(read(data)).toEqual(data);expect(data.criteria).not.toBe(criteria);const text=JSON.stringify(data);for(const field of ['sha256','samples','distanceM','inside','confirmed','csv_text','replay_model'])expect(text).not.toContain(field);data.criteria.label='changed';expect(criteria.label).toBe('Training reference');});
 it.each(['format','circle_model','coordinate_reference'])('rejects unsupported %s',key=>expect(()=>read({...value(),[key]:'future'})).toThrow('Unsupported'));
 it.each([{source_sha256:'a'.repeat(64)},{metrics:{}},{confirmed:true},{csv_text:'not accepted'},{extra:1}])('rejects injected/unknown top-level fields %j',extra=>expect(()=>read({...value(),...extra})).toThrow('Unsupported'));
 it.each([{latitude:'28'},{latitude:null},{latitude:85.1},{longitude:180.1},{radiusM:0},{radiusM:1000001},{label:''},{notes:8},{notes:'x'.repeat(4001)},{inside:5},{confirmed:true}])('rejects invalid criteria %j',patch=>expect(()=>read({...value(),criteria:{...criteria,...patch}})).toThrow());
 it('accepts finite boundary values, zero/negative coordinates and floating-point numeric radius',()=>{for(const point of [{latitude:-85,longitude:-180,radiusM:1},{latitude:85,longitude:180,radiusM:1000000},{latitude:0,longitude:0,radiusM:1.5}])expect(read(referenceCirclePreset({...criteria,...point})).criteria).toEqual({...criteria,...point});});
 it('rejects malformed, null/array, missing schema, oversized UTF8 and nonstring inputs',()=>{for(const text of ['{','null','[]',JSON.stringify({...value(),criteria:undefined})])expect(()=>readReferenceCirclePreset(text)).toThrow();expect(()=>readReferenceCirclePreset('汉'.repeat(22000))).toThrow('64KiB');expect(()=>readReferenceCirclePreset(null)).toThrow('64KiB');});
});
