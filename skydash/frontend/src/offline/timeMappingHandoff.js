import {readMappingCSV} from '../utils/csvColumnMapping';
import {flightCSVHash} from '../utils/flightLog';
import {OFFSET_TIME_VERSION,OFFSET_TIME_HEADER} from './offsetTimeInput';
import {offsetTimeRecipe,parseOffsetTimeRecipe} from './offsetTimeReproduction';
const tick=text=>{
 if(typeof text!=='string'||!/^(?:0|[1-9]\d{0,4})(?:\.\d{1,9})?$/.test(text)||/\.\d*0$/.test(text))throw Error('Prepared nominal-time cells must retain the exact canonical decimal profile.');
 const[seconds,fraction='']=text.split('.');return BigInt(seconds)*1000000000n+BigInt(fraction.padEnd(9,'0'));
};
export async function timeMappingHandoff(result){
 if(result?.format!==OFFSET_TIME_VERSION||typeof result.csv_text!=='string')throw Error('Choose a current explicit timestamp preparation result.');
 // Capture scalar values and reparse exact text before any asynchronous work.
 const text=result.csv_text,column=result.column,original_sha256=result.original_sha256,sha256=result.sha256,original_bytes=result.original_bytes,output_bytes=result.output_bytes,duration=result.duration;
 const parsed=readMappingCSV(text),recipe=parseOffsetTimeRecipe(offsetTimeRecipe({column,original_sha256,sha256,original_bytes,output_bytes,duration,rows:parsed.rows,headers:parsed.headers}));
 if(parsed.headers[column]!==OFFSET_TIME_HEADER||parsed.rows[0][column]!=='0'||parsed.rows.at(-1)[column]!==duration||new Blob([text]).size!==output_bytes)throw Error('Prepared nominal header, bounds or byte count changed. Prepare again before handoff.');
 let previous=-1n;
 for(const row of parsed.rows){const current=tick(row[column]);if(current<=previous||current>21600000000000n)throw Error('Prepared nominal times must strictly increase within the existing six-hour limit.');previous=current;}
 if(await flightCSVHash(text)!==sha256)throw Error('Exact prepared CSV hash changed. No mapper input replaced.');
 return Object.freeze({text,filename:'skydash-nominal-time-input.csv',profile:OFFSET_TIME_VERSION,sha256,original_sha256,original_bytes,prepared_bytes:output_bytes,row_count:recipe.row_count,column_count:recipe.column_count,time_column:column,nominal_duration:duration});
}
