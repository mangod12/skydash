import {useEffect,useRef,useState} from 'react';
import {parseTrialFollowup,serializeTrialFollowup,trialFollowupByteLimit} from './guidedTrialFollowup';
const button='rounded border border-cyan-700 px-3 py-2 disabled:opacity-40';
export default function TrialFollowupFiles({steps,flags,notes,onRestore}){
 const[saveAck,setSaveAck]=useState(false),[replaceAck,setReplaceAck]=useState(false),[preview,setPreview]=useState(null),[reading,setReading]=useState(false),[status,setStatus]=useState('');
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const select=async event=>{
  const file=event.currentTarget.files?.[0]||null,ticket=++generation.current;
  event.currentTarget.value='';setPreview(null);setReplaceAck(false);setSaveAck(false);setReading(false);
  if(!file){setStatus('No personal follow-up selected. Current flags and notes unchanged.');return;}
  if(file.size===0||file.size>trialFollowupByteLimit){setStatus('Personal follow-up refused. Choose the supported JSON, at most 16 KiB. Current flags and notes unchanged.');return;}
  setReading(true);setStatus('Reading only the selected personal follow-up. Nothing replaced.');
  try{
   const value=parseTrialFollowup(new Uint8Array(await file.arrayBuffer()));
   if(ticket!==generation.current)return;
   setPreview(value);setStatus('Personal follow-up preview ready. Inspect all five steps and separately confirm replacement. This does not verify tool use.');
  }catch{if(ticket===generation.current)setStatus('Personal follow-up refused. Choose the supported version 1 JSON with five fixed steps and notes of at most 400 characters. Current flags and notes unchanged.');}
  finally{if(ticket===generation.current)setReading(false);}
 };
 const download=()=>{
  if(!saveAck)return;
  setSaveAck(false);
  try{
   const text=serializeTrialFollowup(flags,notes),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
   a.href=url;a.download='skydash-trial-followup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setStatus('Personal follow-up download requested. Verify saving yourself. No originals, replay or tool-use history included; no sharing performed.');
  }catch{setStatus('Personal follow-up could not be prepared. Current flags and notes unchanged.');}
 };
 return <details className="mt-4 rounded border border-cyan-800 p-3">
  <summary className="cursor-pointer font-semibold text-cyan-200">Save or resume personal trial follow-up</summary>
  <section aria-label="Personal trial follow-up files" className="mt-3 max-w-4xl">
   <p>Only your five manual follow-up flags and private notes, not a completed trial, tool-use history, real review or training record. No original filenames, sources, hashes, pins, choices, consents, accounts or replay state are collected. Notes may contain anything you typed, including sensitive words. Unencrypted, unsigned and editable; confirm the audience yourself.</p>
   <label className="mt-3 flex items-start gap-2 text-amber-100"><input type="checkbox" aria-label="Acknowledge private personal follow-up download" checked={saveAck} onChange={e=>setSaveAck(e.currentTarget.checked)}/><span>I request my complete personal flags and notes as a local JSON download. I will verify saving and protect any sensitive words. This does not save other work.</span></label>
   <button type="button" className={button+' mt-3'} disabled={!saveAck} onClick={download}>Download personal trial follow-up JSON</button>
   <label className="mt-4 block">Select a saved personal follow-up JSON, at most 16 KiB<input type="file" aria-label="Import personal trial follow-up JSON" accept=".json,application/json" className="mt-1 block w-full min-w-0 rounded border border-zinc-700 p-2" onChange={select}/></label>
   {reading&&<p className="mt-2">Reading the selected follow-up only. No replacement yet.</p>}
   {preview&&<section aria-label="Personal trial follow-up replacement preview" className="mt-3 rounded border border-amber-700 p-3">
    <h3 className="font-semibold text-amber-200">Selected personal flags and notes, not verified actions</h3>
    <ol className="mt-3 space-y-3">{preview.steps.map((step,index)=><li key={step.task} className="min-w-0 rounded border border-zinc-700 p-2"><h4 className="font-semibold">{index+1}. {steps[index].title}</h4><p>Personal follow-up flag: {step.flagged?'flagged':'not flagged'}. Neither means complete.</p><p className="mt-1 whitespace-pre-wrap break-words">{step.note||'(No personal note)'}</p></li>)}</ol>
    <label className="mt-3 flex items-start gap-2 text-amber-100"><input type="checkbox" aria-label="Confirm replacement of only personal trial follow-up" checked={replaceAck} onChange={e=>setReplaceAck(e.currentTarget.checked)}/><span>Replace only my current personal trial flags and notes with this complete preview. Other selected files, prepared outputs, private consents, decisions and replay remain unchanged.</span></label>
    <button type="button" className={button+' mt-3'} disabled={!replaceAck} onClick={()=>{if(preview&&replaceAck){setReplaceAck(false);onRestore(preview);}}}>Replace only personal trial follow-up</button>
   </section>}
   <p aria-label="Personal trial follow-up file status" aria-live="polite" className="mt-3">{status}</p>
   <p className="mt-3 text-zinc-400">Every personal flag/note edit or clear invalidates this preview and its acknowledgements, even when reverted. Selecting another file clears the previous preview and acknowledgements, not current personal flags or notes; refused files never change your current follow-up. You must inspect and confirm replacement. No automatic import, navigation, reading of other files, storage, network, upload, sharing, backend write or aircraft command.</p>
  </section>
 </details>;
}
