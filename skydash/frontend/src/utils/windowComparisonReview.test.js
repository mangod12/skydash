import { describe,expect,it } from 'vitest';
import { LOG_VERSION,SAMPLE_LOG,parseFlightCSV } from './flightLog';
import { windowComparisonReview,readWindowComparisonReview } from './windowComparisonReview';
const a={sha256:'a'.repeat(64),model_version:LOG_VERSION,samples:parseFlightCSV(SAMPLE_LOG)},b={...a,sha256:'b'.repeat(64)};
const selection={aFirst:3,aLast:5,bFirst:2,bLast:4,label:'Instructor handoff',notes:'Private discussion context'};
const value=()=>windowComparisonReview(a,b,selection),read=data=>readWindowComparisonReview(JSON.stringify(data),a,b);
describe('portable independent window comparison review',()=>{
 it('roundtrips exact ordered source identities and selections only, no CSV/coordinates/metrics/anchors',()=>{const data=value();expect(read(data)).toEqual(data);expect(data.selection).not.toBe(selection);for(const text of ['samples','csv_text','latitude','longitude','durationS','deltas','alignment'])expect(JSON.stringify(data)).not.toContain(text);expect(data.selection.notes).toBe('Private discussion context');});
 it.each(['format','replay_model','window_model','comparison_model'])('rejects unsupported %s',key=>expect(()=>read({...value(),[key]:'future'})).toThrow('Unsupported'));
 it.each([{extra:'unexpected'},{summary:{count:999}},{csv_text:SAMPLE_LOG},{alignment:{}}])('rejects unknown top-level fields %j',extra=>expect(()=>read({...value(),...extra})).toThrow('Unsupported'));
 it.each([{aFirst:'3'},{aFirst:1.5},{aFirst:0},{aLast:7},{bFirst:4,bLast:2},{label:''},{label:'x'.repeat(121)},{notes:'x'.repeat(4001)},{notes:5},{summary:[]}])('rejects invalid imported selection %j',patch=>expect(()=>read({...value(),selection:{...selection,...patch}})).toThrow());
 it('requires exact ordered identities, never swapping sides or applying to another source',()=>{expect(()=>readWindowComparisonReview(JSON.stringify(value()),b,a)).toThrow('Ordered');expect(()=>read({...value(),primary_sha256:'c'.repeat(64)})).toThrow('Ordered');expect(()=>read({...value(),baseline_sha256:'B'.repeat(64)})).toThrow('Ordered');});
 it('accepts identical source windows without treating checksum as independent-flight proof',()=>{const data=windowComparisonReview(a,a,{...selection,aFirst:4,aLast:4,bFirst:4,bLast:4});expect(readWindowComparisonReview(JSON.stringify(data),a,a)).toEqual(data);});
 it('rejects malformed JSON, arrays, null, omitted fields and oversized UTF8',()=>{for(const text of ['{','[]','null',JSON.stringify({...value(),selection:undefined})])expect(()=>readWindowComparisonReview(text,a,b)).toThrow();expect(()=>readWindowComparisonReview('汉'.repeat(22000),a,b)).toThrow('64KiB');expect(()=>readWindowComparisonReview(null,a,b)).toThrow('64KiB');});
 it('requires supported live source metadata on creation and reopening',()=>{expect(()=>windowComparisonReview({...a,sha256:'bad'},b,selection)).toThrow('supported');expect(()=>readWindowComparisonReview(JSON.stringify(value()),{...a,model_version:'future'},b)).toThrow('supported');});
 it('does not mutate source samples, fields or the parsed input when rebuilding',()=>{const data=value(),before=JSON.stringify(data),source=JSON.stringify(a);const result=read(data);result.selection.notes='changed';expect(JSON.stringify(data)).toBe(before);expect(JSON.stringify(a)).toBe(source);});
});
