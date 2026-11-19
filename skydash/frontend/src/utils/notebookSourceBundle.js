import { LOG_VERSION, MAX_LOG_BYTES, parseFlightCSV, flightCSVHash } from './flightLog';
import { readWindowNotebook, windowNotebook } from './windowNotebook';
export const NOTEBOOK_BUNDLE_VERSION='skydash-notebook-source-bundle-v1';
export const MAX_NOTEBOOK_BUNDLE_BYTES=2*1024*1024;
export const NOTEBOOK_BUNDLE_SCOPE='PORTABLE EXACT-SOURCE NOTEBOOK, NOT A SIGNED TRAINING RECORD. Includes the entire exact primary CSV, including outside-window coordinates/readings, plus every applied saved window label/private note. No automatic upload/sharing or backend record. Source fingerprint checks exact bytes, not authenticity/authorship/custody. Current unsaved fields, other reviews and comparison are excluded. Opening replaces the local source and clears all other review panels/drafts/comparison, even for identical source bytes. Saved notebook copies reopen, not the current window result. Keep other work separately before confirmation.';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
async function checked(data){
 if(!exact(data,['format','replay_model','source','notebook'])||data.format!==NOTEBOOK_BUNDLE_VERSION||data.replay_model!==LOG_VERSION)throw new Error('Unsupported notebook source bundle fields or replay model.');
 if(!exact(data.source,['filename','csv_text','sha256'])||typeof data.source.filename!=='string'||!data.source.filename.trim()||data.source.filename.length>120||typeof data.source.csv_text!=='string'||new Blob([data.source.csv_text]).size>MAX_LOG_BYTES||typeof data.source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.source.sha256))throw new Error('Invalid notebook bundle source metadata or CSV size.');
 const samples=parseFlightCSV(data.source.csv_text);
 if(await flightCSVHash(data.source.csv_text)!==data.source.sha256)throw new Error('Notebook bundle source fingerprint mismatch. Nothing opened.');
 const log={...data.source,samples,model_version:LOG_VERSION,title:data.source.filename.replace(/\.csv$/i,''),notes:''};
 const notebook=readWindowNotebook(JSON.stringify(data.notebook),log);
 if(!notebook.windows.length)throw new Error('Notebook source bundle needs at least one saved window copy.');
 return {data:{...data,notebook},log};
}
export async function createNotebookSourceBundle(log,entries){
 if(!log||log.model_version!==LOG_VERSION)throw new Error('Load a supported exact primary CSV before bundling saved copies.');
 const notebook=windowNotebook({...log,samples:parseFlightCSV(log.csv_text)},entries);
 const data={format:NOTEBOOK_BUNDLE_VERSION,replay_model:LOG_VERSION,source:{filename:log.filename,csv_text:log.csv_text,sha256:log.sha256},notebook};
 const verified=await checked(data),text=JSON.stringify(verified.data,null,2);
 if(new Blob([text]).size>MAX_NOTEBOOK_BUNDLE_BYTES)throw new Error('Notebook source bundle exceeds 2MiB. Keep exact source CSV and notebook JSON separately.');
 return text;
}
export async function readNotebookSourceBundle(text){
 if(typeof text!=='string'||new Blob([text]).size>MAX_NOTEBOOK_BUNDLE_BYTES)throw new Error('Notebook source bundle JSON must be at most 2MiB.');
 let data;try{data=JSON.parse(text);}catch{throw new Error('Notebook source bundle is not valid JSON.');}
 return checked(data);
}
