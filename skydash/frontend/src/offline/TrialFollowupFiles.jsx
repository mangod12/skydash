import {useEffect,useRef,useState} from 'react';
import {parseTrialFollowup,serializeTrialFollowup,trialFollowupByteLimit} from './guidedTrialFollowup';
import {preparePersonalTrialReport,personalTrialStepTitles,parsePersonalTrialOrdinals} from './personalTrialReport';
const button='rounded border border-cyan-700 px-3 py-2 disabled:opacity-40';
export default function TrialFollowupFiles({steps,flags,notes,sheet,onSheetChange,onRestore}){
 const[saveAck,setSaveAck]=useState(false),[replaceAck,setReplaceAck]=useState(false),[preview,setPreview]=useState(null),[reading,setReading]=useState(false),[status,setStatus]=useState('');
 const[report,setReport]=useState(null),[reportAck,setReportAck]=useState(false);
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const select=async event=>{
  const file=event.currentTarget.files?.[0]||null,ticket=++generation.current;
  event.currentTarget.value='';setPreview(null);setReplaceAck(false);setSaveAck(false);setReport(null);setReportAck(false);setReading(false);
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
 let ordinals=null,selectionValid=sheet.scope==='all'||sheet.scope==='selected';
 if(sheet.scope==='selected'){try{ordinals=parsePersonalTrialOrdinals(sheet.ordinals);}catch{selectionValid=false;}}
 const changeSheet=change=>{setReport(null);setReportAck(false);onSheetChange({...sheet,...change});setStatus('Readable sheet scope changed only. Prepare and inspect again. Saved-file replacement preview and JSON-download consent unchanged.');};
 const prepareReport=()=>{
  if(reading||!selectionValid)return;
  setReport(null);setReportAck(false);
  try{setReport(preparePersonalTrialReport(flags,notes,ordinals));setStatus('Readable personal follow-up prepared. Inspect every included flag and complete note below. Nothing downloaded or shared.');}
  catch{setStatus('Readable personal follow-up refused. Current personal flags and notes unchanged.');}
 };
 const downloadReport=()=>{
  if(!report||!reportAck||reading)return;
  setReportAck(false);
  try{
   const url=URL.createObjectURL(new Blob([report.html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');
   a.href=url;a.download='skydash-personal-trial-followup.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setStatus('Readable personal follow-up download requested. Verify saving yourself. Only the inspected personal flags and notes included; no sharing performed.');
  }catch{setStatus('Readable personal follow-up download could not be requested. No personal values changed.');}
 };
 return <details className="mt-4 rounded border border-cyan-800 p-3">
  <summary className="cursor-pointer font-semibold text-cyan-200">Save or resume personal trial follow-up</summary>
  <section aria-label="Personal trial follow-up files" className="mt-3 max-w-4xl">
   <p>Only your five manual follow-up flags and private notes, not a completed trial, tool-use history, real review or training record. No original filenames, sources, hashes, pins, choices, consents, accounts or replay state are collected. Notes may contain anything you typed, including sensitive words. Unencrypted, unsigned and editable; confirm the audience yourself.</p>
   <label className="mt-3 flex items-start gap-2 text-amber-100"><input type="checkbox" aria-label="Acknowledge private personal follow-up download" checked={saveAck} onChange={e=>setSaveAck(e.currentTarget.checked)}/><span>I request my complete personal flags and notes as a local JSON download. I will verify saving and protect any sensitive words. This does not save other work.</span></label>
   <button type="button" className={button+' mt-3'} disabled={!saveAck} onClick={download}>Download personal trial follow-up JSON</button>
   <section aria-label="Readable personal trial follow-up" className="mt-4 rounded border border-cyan-800 p-3">
    <h3 className="font-semibold text-cyan-200">Prepare a readable personal follow-up sheet</h3>
    <p className="mt-2">Choose all five instruction steps or only explicit step numbers. Complete included notes may contain sensitive words you typed. Not verified tool use or completion. Inspect the full included preview and audience before a separate HTML download. No scripts or external assets. Saving, printing and sharing remain manual; HTML cannot resume your follow-up.</p>
    <label className="mt-3 block">Readable sheet scope<select aria-label="Personal follow-up sheet scope" className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2" disabled={reading} value={sheet.scope} onChange={event=>changeSheet({scope:event.currentTarget.value})}><option value="all">All five instruction steps</option><option value="selected">Only explicit instruction step numbers</option></select></label>
    {sheet.scope==='selected'&&<div className="mt-3"><label>Instruction step numbers, comma-separated<input type="text" aria-label="Personal follow-up sheet instruction steps" className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2" maxLength={25} autoComplete="off" spellCheck={false} disabled={reading} value={sheet.ordinals} onChange={event=>changeSheet({ordinals:event.currentTarget.value})}/></label><p className="mt-2 text-zinc-400">Unique numbers 1 to 5, for example 1,3. No ranges or automatic selection from flags. Original instruction order and numbers retained, not typed order. Only explicitly chosen steps appear. Omitted notes and flag states are never evidence of no other follow-up.</p>{!selectionValid&&<p className="mt-2 text-amber-100">Enter unique comma-separated instruction step numbers 1 to 5 before preparation.</p>}</div>}
    <p className="mt-2 text-zinc-400">Scope edits discard only the readable preview and its acknowledgement, even if reverted. Personal edits keep this chosen scope but discard every prepared preview and acknowledgement. Scope is in-tab only and is not saved in personal JSON. This scope never narrows the separate JSON download, which always includes all five flags and notes.</p>
    <button type="button" className={button+' mt-3'} disabled={reading||!selectionValid} onClick={prepareReport}>Prepare readable personal follow-up</button>
    {report&&<section aria-label="Readable personal follow-up preview" className="mt-3">
     <h4 className="font-semibold text-amber-200">Inspect included personal flags and complete notes</h4>
     <p className="mt-2">Instruction steps {report.ordinals.join(', ')} of 5. {report.ordinals.length<5?'Explicit partial sheet. Omitted steps are not evidence of no other follow-up.':'All five instruction steps included.'}</p>
     <ol className="mt-3 space-y-3">{report.steps.map((step,index)=><li key={step.task} className="min-w-0 rounded border border-zinc-700 p-2"><h5 className="font-semibold">{report.ordinals[index]}. {personalTrialStepTitles[report.ordinals[index]-1]}</h5><p>Personal follow-up flag: {step.flagged?'flagged':'not flagged'}. Neither means complete.</p><p className="mt-1 whitespace-pre-wrap break-words">{step.note||'(No personal note)'}</p></li>)}</ol>
     <label className="mt-3 flex items-start gap-2 text-amber-100"><input type="checkbox" aria-label="Acknowledge complete private personal follow-up HTML" checked={reportAck} onChange={event=>setReportAck(event.currentTarget.checked)}/><span>I inspected every included personal flag and complete note. I request this unencrypted, unsigned HTML locally and will protect any private words, verify saving and confirm the audience myself.</span></label>
     <button type="button" className={button+' mt-3'} disabled={!reportAck||reading} onClick={downloadReport}>Download readable personal follow-up HTML</button>
    </section>}
   </section>
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
