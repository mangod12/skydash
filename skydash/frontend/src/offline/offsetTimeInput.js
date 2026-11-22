import {readMappingCSV} from '../utils/csvColumnMapping';
import {flightCSVHash,MAX_LOG_BYTES} from '../utils/flightLog';
export const OFFSET_TIME_VERSION='skydash-offset-time-input-v1';
export const OFFSET_TIME_HEADER='skydash_nominal_seconds';
export const OFFSET_TIME_SCOPE='EXPLICIT TIMESTAMP REBASING ONLY. Nominal UTC calendar arithmetic uses 86,400-second days, not leap-second-aware or measured physical elapsed time. Timestamp column meaning, source clock accuracy and all other field meanings are unverified. This intermediate CSV is not a validated replay source. No aircraft format, units or coordinate reference are inferred.';
const billion=1000000000n;
export function offsetTimestampNs(value){
 const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!match)throw new Error('Use YYYY-MM-DDTHH:mm:ss with optional 1 to 9 fraction digits and explicit uppercase Z or signed HH:mm offset. No local-only dates, zone names, spaces or extensions.');
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]),offsetHour=Number(match[10]||0),offsetMinute=Number(match[11]||0);
 if(month<1||month>12||day<1||day>31||hour>23||minute>59||second>59||offsetHour>23||offsetMinute>59)throw new Error('Invalid calendar time or numeric offset. Leap-second labels and 24:00 are unsupported.');
 const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(hour,minute,second,0);
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('Invalid Gregorian calendar date. No rollover repair is performed.');
 const offset=(offsetHour*60+offsetMinute)*60*(match[9]==='-'?-1:1);
 return BigInt(date.getTime())*1000000n-BigInt(offset)*billion+BigInt((match[7]||'').padEnd(9,'0'));
}
const decimalSeconds=value=>{const whole=value/billion,fraction=String(value%billion).padStart(9,'0').replace(/0+$/,'');return String(whole)+(fraction?'.'+fraction:'');};
const cell=value=>/[",\n\r]/.test(value)?'"'+value.replace(/"/g,'""')+'"':value;
export async function rebaseOffsetTimeCSV(text,column){
 const source=readMappingCSV(text);
 if(!Number.isInteger(column)||column<0||column>=source.headers.length)throw new Error('Choose exactly one source timestamp column explicitly.');
 if(source.headers.some((header,index)=>index!==column&&header===OFFSET_TIME_HEADER))throw new Error('Another column already uses the fixed output time header. Refused rather than renaming or losing it.');
 const headers=source.headers.map((header,index)=>index===column?OFFSET_TIME_HEADER:header),rows=[];let first,previous,last;
 source.rows.forEach((values,index)=>{
  let current;try{current=offsetTimestampNs(values[column]);}catch(error){throw new Error(`Source data row ${index+1}: ${error.message} Entire preparation refused; no rows skipped.`);}
  if(index===0)first=current;
  if(previous!==undefined&&current<=previous)throw new Error(`Source data row ${index+1}: represented UTC timestamps must strictly increase. No sorting, deduplication or clock repair.`);
  last=current-first;if(last>21600n*billion)throw new Error('Nominal timestamp span exceeds the existing 21,600-second replay limit. No rows truncated.');
  rows.push(values.map((value,cellIndex)=>cellIndex===column?decimalSeconds(last):value));previous=current;
 });
 const csv_text=headers.map(cell).join(',')+'\n'+rows.map(values=>values.map(cell).join(',')).join('\n')+'\n';
 if(new Blob([csv_text]).size>MAX_LOG_BYTES)throw new Error('Prepared CSV exceeds 1MiB after normalized serialization. Entire preparation refused.');
 const original_sha256=await flightCSVHash(text),sha256=await flightCSVHash(csv_text);
 return {format:OFFSET_TIME_VERSION,column,headers,rows,csv_text,original_sha256,sha256,original_bytes:new Blob([text]).size,output_bytes:new Blob([csv_text]).size,duration:decimalSeconds(last),filename:'skydash-nominal-time-input.csv'};
}
export function offsetTimeRecord(result){
 return ['SKYDASH / EXPLICIT OFFSET TIMESTAMP INPUT RECORD',OFFSET_TIME_VERSION,OFFSET_TIME_SCOPE,'',`Original exact UTF-8 SHA-256: ${result.original_sha256}`,`Original UTF-8 bytes: ${result.original_bytes}`,`Prepared exact UTF-8 SHA-256: ${result.sha256}`,`Prepared UTF-8 bytes: ${result.output_bytes}`,`Chosen source column ordinal: ${result.column+1}`,`Fixed prepared time header: ${OFFSET_TIME_HEADER}`,`Data rows retained in original order: ${result.rows.length}`,`Nominal last-minus-first span: ${result.duration}s`,'','Explicit uppercase T/Z profile; four-digit Gregorian years, second labels 00..59, optional 1..9 fraction digits, literal numeric offsets 00:00..23:59. No leap-second labels, local-zone inference, clock verification, zone names or bracketed extensions. UTC zero spellings Z,+00:00,-00:00 give the same instant arithmetic without establishing the source local time zone.','Integer nanosecond arithmetic subtracts the first represented instant before writing bounded decimal seconds. Civil-day arithmetic ignores leap seconds. No physical elapsed-time claim.','Only the selected timestamp data cells are replaced. All other decoded data-cell values and column/row order remain, including unknown private fields or spreadsheet formulas. Header labels are trimmed by the existing bounded CSV reader, and the selected header is replaced by the fixed name. CSV quoting, BOM and line endings are normalized, not byte-preserved.','WARNING: the intermediate CSV retains every other source column, including private coordinates, notes and formula-like cells. Do not open it as a spreadsheet. It is not a privacy-reduced export. This record omits filenames, header labels, source dates and other cell values, but source hashes and shape can be sensitive.','NEXT MANUAL STEP: choose the prepared CSV in the existing numeric column mapper. Explicitly select meanings/units, numeric time in seconds starting at zero, coordinate reference and optional channels there. No prepared file is transferred, opened in replay or uploaded automatically.','Keep the exact original timestamp CSV, this record and the prepared intermediate CSV separately, plus any later numeric mapping record and final replay CSV. Existing portable cases and numeric-mapping lineage do not incorporate or verify this timestamp stage. This editable unsigned record is not authentication, a machine-readable mapping recipe or a verified source chain.'].join('\n');
}
