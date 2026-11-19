import { CIRCLE_VERSION,validateReferenceCircle } from './referenceCircle';
export const CIRCLE_PRESET_VERSION='skydash-reference-circle-preset-v1';
export const MAX_CIRCLE_PRESET_BYTES=65536;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function referenceCirclePreset(criteria){
 const value={format:CIRCLE_PRESET_VERSION,circle_model:CIRCLE_VERSION,coordinate_reference:'WGS84-decimal-degrees',criteria:validateReferenceCircle(criteria)};
 if(new Blob([JSON.stringify(value,null,2)]).size>MAX_CIRCLE_PRESET_BYTES)throw new Error('Reference circle preset must be at most 64KiB.');
 return value;
}
export function readReferenceCirclePreset(text){
 if(typeof text!=='string'||new Blob([text]).size>MAX_CIRCLE_PRESET_BYTES)throw new Error('Reference circle preset must be at most 64KiB.');
 let value;try{value=JSON.parse(text);}catch{throw new Error('Reference circle preset is not valid JSON.');}
 if(!exact(value,['format','circle_model','coordinate_reference','criteria'])||value.format!==CIRCLE_PRESET_VERSION||value.circle_model!==CIRCLE_VERSION||value.coordinate_reference!=='WGS84-decimal-degrees')throw new Error('Unsupported reference circle preset fields, model or coordinate reference.');
 return referenceCirclePreset(value.criteria);
}
