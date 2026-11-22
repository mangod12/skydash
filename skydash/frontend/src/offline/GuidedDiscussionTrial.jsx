import {useState} from 'react';

const steps = [
  {task:'discussionExamples',title:'Prepare and save fabricated originals',action:'Open fabricated discussion examples',body:'Prepare the fixed examples, then deliberately save Left, Right and no-instructor ZIPs and the guide. Left and Right each contain five entries; the third has four with instructor explicitly absent. All reuse one fabricated CSV with gaps and missing cells. These are standard discussion-original ZIPs, not training-package ZIPs. They are not three independent flights.'},
  {task:'discussionIntake',title:'Check the three saved ZIPs separately',action:'Open discussion intake queue',body:'Explicitly select your saved ZIPs and check them. Inspect every selected position, the same-source byte relation and the absent instructor. Missing instructor is not an empty review or completed work. A refused file remains refused. Generated hashes are not independent expectations; leave expectation fields empty unless you have an independent source. Optional JSON/HTML downloads need their own action and saving check.'},
  {task:'discussionCompare',title:'Compare Left and Right without merging',action:'Open separate discussion snapshot comparison',body:'Select Left and Right again in the separate comparison tool. The aggregate check can show equal raw CSV bytes and differing originals without revealing original words. Private-word comparison and whole-component handoff each need their own consent and actions. Equal fingerprints do not prove authorship, chronology, consensus or independent flights.'},
  {task:'checklistCombine',title:'Make explicit whole-item checklist choices',action:'Open explicit checklist combination',body:'Choose the discussion ZIP input route, select Left and Right manually and acknowledge private preview only if appropriate. Inspect the different complete same-ID prompts. Title and conflicting whole-item choices remain unresolved until you choose; no choice is recommended here. A prepared/downloaded candidate is separate JSON, not an applied review or evidence of agreement. Keep the originals.'},
  {task:'receivedDiscussion',title:'Optionally recover originals for manual reopening',action:'Open received discussion original recovery',body:'Protect unsaved real work first. Separately select and recheck an example ZIP in the receiver, choose one original role and acknowledge its sensitive download. Opening CSV, a checklist candidate or instructor JSON in replay still requires deliberate saved-file selection and each existing replacement confirmation. Recovery does not extract automatically, recreate a complete workspace or apply the candidate.'}
];

export default function GuidedDiscussionTrial({onChoose}) {
  const [flags,setFlags]=useState([]),[status,setStatus]=useState('');
  const open=task=>{
    const opened=typeof onChoose==='function' && onChoose(task);
    setStatus(opened?'Requested the existing section only. Select files and perform each action yourself. No file, consent or choice transferred.':'The requested section is unavailable. No trial action was performed.');
  };
  return <details className="border-b border-cyan-800 bg-cyan-950/10 px-4 py-3 text-sm">
    <summary className="cursor-pointer font-semibold text-cyan-200">Guided fabricated discussion trial (start here)</summary>
    <section aria-label="Guided fabricated discussion trial" className="mt-3 max-w-5xl">
      <h2 className="font-semibold text-cyan-200">Try the local handoff route before using real originals</h2>
      <p className="mt-2">Instructions and navigation only, not an automated demo. No selected file, active review, saved output, account or library is read. Opening a step never prepares examples, transfers selections, fills pins, grants consent, chooses a candidate, changes replay or proves that you used a tool.</p>
      <p className="mt-2 text-amber-100">Every example is fabricated and unsigned. No actual OEM compatibility, real people, accepted training, grades, certification, readiness or flight clearance is established. Human annotations are not detected events or approved operational instructions.</p>
      <ol aria-label="Fabricated discussion trial route" className="mt-3 grid gap-3 lg:grid-cols-2">
        {steps.map((step,index)=><li key={step.task} className="min-w-0 rounded border border-cyan-900 p-3">
          <h3 className="font-semibold">{index+1}. {step.title}</h3><p className="mt-2 text-zinc-300">{step.body}</p>
          <button type="button" className="mt-3 max-w-full rounded border border-cyan-700 px-3 py-2 text-left" onClick={()=>open(step.task)}>{step.action}</button>
          <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-1 shrink-0" aria-label={'Flag trial step '+(index+1)+' for follow-up'} checked={flags.includes(step.task)} onChange={event=>{const checked=event.currentTarget.checked;setFlags(previous=>checked?[...previous.filter(task=>task!==step.task),step.task]:previous.filter(task=>task!==step.task));}}/>Flag for my follow-up, not completion</label>
        </li>)}
      </ol>
      <p aria-label="Personal trial follow-up count" className="mt-3">{flags.length} of {steps.length} instruction steps flagged for your follow-up. These manual in-tab flags are not a completed task list, tool-use history or training record.</p>
      <button type="button" className="mt-2 rounded border border-zinc-600 px-3 py-2" onClick={()=>{setFlags([]);setStatus('Personal trial flags cleared only. Selected files, prepared results, active reviews, replay clocks and saved downloads unchanged.');}}>Clear only personal trial flags</button>
      <p role="status" aria-label="Guided discussion trial status" aria-live="polite" className="mt-3">{status}</p>
      <p className="mt-3 text-zinc-400">Return through the task chooser or this disclosure. Opening another tool hides this guide without resetting its flags or unmounting other tools. Flags are not saved; refresh or tab close loses them. Clearing flags does not clear other work. No automatic reading, download, extraction, import, storage, network, upload/sharing, backend write or aircraft command. Preserve every real original and unsaved work separately.</p>
    </section>
  </details>;
}
