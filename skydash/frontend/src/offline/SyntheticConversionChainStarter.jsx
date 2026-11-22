import {useEffect,useRef,useState} from 'react';
import {syntheticConversionChainStarter} from './syntheticConversionChainStarter';
const button='rounded border border-emerald-800 px-3 py-2 text-xs disabled:opacity-40';
export default function SyntheticConversionChainStarter({disabled=false}){
 const[result,setResult]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),busyRef=useRef(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;busyRef.current=false;},[]);
 const prepare=async()=>{
  if(disabled||busyRef.current)return;
  const version=++generation.current;busyRef.current=true;setBusy(true);setResult(null);setMessage('Preparing only fixed fabricated practice inputs. No selected ZIP or current work read.');
  try{const prepared=await syntheticConversionChainStarter();if(generation.current===version){setResult(prepared);setMessage('Two fixed matching chains and one intentionally nonmatching final prepared. No download or receiving check started.');}}
  catch{if(generation.current===version)setMessage('Fabricated practice preparation refused. No partial outputs or current-work changes.');}
  finally{if(generation.current===version){busyRef.current=false;setBusy(false);}}
 };
 const download=key=>{
  if(disabled||busyRef.current||!result)return;
  const archive=result.archives.find(value=>value.key===key);if(key!=='guide'&&!archive)return;
  let url,anchor;
  try{url=URL.createObjectURL(new Blob([archive?archive.bytes:result.guide],{type:archive?'application/zip':'text/plain;charset=utf-8'}));anchor=document.createElement('a');anchor.href=url;anchor.download=archive?archive.filename:'SKYDASH-FABRICATED-CONVERSION-CHAIN-GUIDE.txt';document.body.appendChild(anchor);anchor.click();setMessage('Fixed fabricated '+(archive?archive.key+' ZIP':'practice guide')+' download requested. Verify saving, then manually choose a saved ZIP in the separate checker. No selection or statement supplied.');}
  catch{setMessage('Fabricated example download could not start. Prepared practice retained; no receiver selection or statement changed.');}
  finally{anchor?.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);}
 };
 return <section aria-label="Fixed fabricated conversion-chain practice" className="max-w-6xl space-y-3 rounded border border-emerald-800 p-3">
  <h3 className="font-semibold text-emerald-200">Try the complete chain check with fabricated originals first</h3>
  <p>Prepare two matching fixed timestamp-to-numeric chains and one complete ZIP with an intentionally changed final CSV. BAD-FINAL keeps a copied success receipt and valid ZIP CRCs, but its actual exact numeric relation must refuse. MATCH-A and MATCH-B use different fabricated dates; coherent agreement is not authenticity. Not recordings, people, independent flights, OEM compatibility or completed training.</p>
  <p className="text-amber-200">No selected file, receiver selection, statements, expectations, result or active work is read or changed. The generator checks only its own known fixed exercise semantics. That cannot supply your fresh interpretation statements or independent expectations. Generated hashes are reproducibility fingerprints, not independent proof. Save manually, inspect originals with trusted software, then explicitly choose one saved ZIP and make your own separate statements above. No auto-download, extraction, import, opening, storage, network or sharing.</p>
  <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled||busy} onClick={prepare}>Prepare fabricated chain practice</button>{['match-a','match-b','bad-final'].map(key=><button key={key} type="button" className={button} disabled={disabled||busy||!result} onClick={()=>download(key)}>Download fabricated chain {key} ZIP</button>)}<button type="button" className={button} disabled={disabled||busy||!result} onClick={()=>download('guide')}>Download fabricated chain practice guide</button><button type="button" className={button} disabled={disabled||busy} onClick={()=>{if(busyRef.current||disabled)return;generation.current++;setResult(null);setMessage('Only fabricated practice outputs cleared. Receiver selections, statements and results remain unchanged.');}}>Clear fabricated chain practice</button></div>
  {message&&<p role="status" aria-label="Fabricated chain practice status" className="text-emerald-100">{message}</p>}
  {result&&<ol aria-label="Prepared fabricated chain exercises" className="space-y-2">{result.archives.map(archive=><li key={archive.key} className="min-w-0 rounded border border-zinc-700 p-2"><strong>{archive.key.toUpperCase()}</strong>: expected fresh-check outcome {archive.expectedOutcome}; {archive.fileCount} fixed entries, {archive.bytes.byteLength} bytes. Generated ZIP SHA-256 <span className="break-all font-mono">{archive.archiveDigest}</span>. No independent expectation supplied.</li>)}</ol>}
  <p className="text-zinc-400">The separate guide explains the fixed source columns, nominal seconds 0,4,12 and unchanged 8-second source interval, fabricated WGS84 coordinates and excluded note column. These unsigned unencrypted examples are not workspace backups, operational instructions, grades, certification, readiness or clearance. Clear affects only these prepared examples; hiding retains them, refresh/tab close loses them. Preserve all real originals and excluded work separately.</p>
 </section>;
}
