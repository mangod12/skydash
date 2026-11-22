import {flightCSVHash,MAX_LOG_BYTES} from '../utils/flightLog';
import {OFFSET_TIME_VERSION,rebaseOffsetTimeCSV} from './offsetTimeInput';
export const OFFSET_RECIPE_VERSION='skydash-offset-time-recipe-v1';
export const OFFSET_REPRODUCTION_VERSION='skydash-offset-time-reproduction-v1';
export const OFFSET_REPRODUCTION_SCOPE='EXACT TIMESTAMP PREPARATION RELATION ONLY. This checkout regenerated every intermediate cell from the selected original using the selected timestamp-only recipe and compared all prepared UTF-8 bytes. Nominal UTC calendar arithmetic assumes 86,400-second days, not leap-second-aware or measured physical elapsed time. Fresh caller confirmation does not verify timestamp meaning or source clock accuracy. Recipe hashes are supplied claims, not independently obtained expectations or authentication. All other original columns, including private and formula-like cells, remain in the intermediate. No replay opened and no output written, uploaded, stored or shared automatically. This relation is not a numeric field/unit/coordinate conversion, a manufacturer-format check or a flight identity, custody, grade or readiness claim. Existing numeric recipes, lineage and portable cases do not incorporate this timestamp stage. Keep exact original, timestamp recipe/record, intermediate and later numeric recipe/record/final CSV separately. Hashes, shape and column ordinal may identify sensitive work.';
const fields=['format','profile','column','original_sha256','prepared_sha256','original_bytes','prepared_bytes','row_count','column_count','duration'];
const keys=value=>Object.keys(value).sort().join(',');
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const durationValid=value=>{
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,4})(?:\.\d{1,9})?$/.test(value)||/\.\d*0$/.test(value))return false;
 const[seconds,fraction='']=value.split('.'),ns=BigInt(seconds)*1000000000n+BigInt(fraction.padEnd(9,'0'));
 return ns>0n&&ns<=21600000000000n;
};
export function parseOffsetTimeRecipe(text){
 if(typeof text!=='string'||new Blob([text]).size>65536)throw new Error('Timestamp recipe must be bounded UTF-8 JSON, at most 64KiB.');
 let recipe;try{recipe=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('Timestamp recipe is not valid JSON.');}
 if(!recipe||typeof recipe!=='object'||Array.isArray(recipe)||keys(recipe)!==fields.slice().sort().join(','))throw new Error('Timestamp recipe fields must match this fixed profile exactly.');
 if(recipe.format!==OFFSET_RECIPE_VERSION||recipe.profile!==OFFSET_TIME_VERSION)throw new Error('Unsupported timestamp recipe format or arithmetic profile.');
 if(!integer(recipe.column_count,3,64)||!integer(recipe.column,0,recipe.column_count-1)||!integer(recipe.row_count,2,10000)||!integer(recipe.original_bytes,1,MAX_LOG_BYTES)||!integer(recipe.prepared_bytes,1,MAX_LOG_BYTES)||!durationValid(recipe.duration))throw new Error('Invalid timestamp recipe ordinal, shape, byte counts or nominal duration.');
 if(typeof recipe.original_sha256!=='string'||!/^[a-f0-9]{64}$/.test(recipe.original_sha256)||typeof recipe.prepared_sha256!=='string'||!/^[a-f0-9]{64}$/.test(recipe.prepared_sha256))throw new Error('Timestamp recipe requires complete lowercase exact-file SHA-256 claims.');
 return recipe;
}
export function offsetTimeRecipe(result){
 const recipe={format:OFFSET_RECIPE_VERSION,profile:OFFSET_TIME_VERSION,column:result.column,original_sha256:result.original_sha256,prepared_sha256:result.sha256,original_bytes:result.original_bytes,prepared_bytes:result.output_bytes,row_count:result.rows.length,column_count:result.headers.length,duration:result.duration};
 const text=JSON.stringify(recipe,null,2)+'\n';parseOffsetTimeRecipe(text);return text;
}
export async function reproduceOffsetTimeInput(originalText,recipeText,preparedBytes,{confirmedNominal=false}={}){
 if(confirmedNominal!==true)throw new Error('A fresh explicit nominal timestamp interpretation confirmation is required. A recipe cannot supply it.');
 if(!(preparedBytes instanceof Uint8Array)||preparedBytes.byteLength>MAX_LOG_BYTES)throw new Error('Choose bounded exact prepared bytes, at most 1MiB.');
 const snapshot=new Uint8Array(preparedBytes),recipe=parseOffsetTimeRecipe(recipeText);
 const result=await rebaseOffsetTimeCSV(originalText,recipe.column);
 const regenerated=parseOffsetTimeRecipe(offsetTimeRecipe(result));
 if(fields.some(field=>regenerated[field]!==recipe[field]))throw new Error('Timestamp recipe claims do not match exact original input and regenerated preparation.');
 const expected=new TextEncoder().encode(result.csv_text);
 if(expected.byteLength!==snapshot.byteLength||expected.some((value,index)=>value!==snapshot[index]))throw new Error('Exact prepared bytes differ from regenerated timestamp preparation. No repair or partial match accepted.');
 return {format:OFFSET_REPRODUCTION_VERSION,profile:OFFSET_TIME_VERSION,exact_original_sha256:result.original_sha256,exact_recipe_sha256:await flightCSVHash(recipeText),exact_prepared_sha256:result.sha256,original_bytes:result.original_bytes,recipe_bytes:new Blob([recipeText]).size,prepared_bytes:snapshot.byteLength,row_count:result.rows.length,column_count:result.headers.length,chosen_column_ordinal:result.column+1,nominal_duration:result.duration,scope:OFFSET_REPRODUCTION_SCOPE};
}
