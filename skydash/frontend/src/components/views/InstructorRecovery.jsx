import {useState} from 'react';
import {debriefSidecar} from '../../utils/instructorDebrief';
import {instructorReplacement} from '../../utils/instructorReplacement';
import InstructorReplacement from './InstructorReplacement';
const button='rounded border border-amber-500/25 px-3 py-2 text-xs text-amber-200 disabled:opacity-40';
export default function InstructorRecovery({log,markers,notes,previous,disabled,onPause,onRestore}){
 const[preview,setPreview]=useState(null),[error,setError]=useState('');
 const current=()=>instructorReplacement(log,markers,notes,debriefSidecar(log,previous.markers,previous.notes));
 const review=()=>{if(disabled||!previous)return;onPause();setError('');try{setPreview(current());}catch(failure){setError(failure.message);}};
 const restore=()=>{if(disabled||!preview)return;onPause();setError('');try{if(JSON.stringify(current())!==JSON.stringify(preview))throw Error('Instructor recovery state changed. Preview again.');onRestore(preview);}catch(failure){setError(failure.message||'Instructor review not restored.');}};
 return <section aria-label="Previous instructor review recovery" className="rounded border border-amber-500/25 p-3 space-y-3 text-xs text-zinc-400"><h3 className="font-semibold text-amber-200">Recover the previous saved instructor review</h3>
 <p>One session-only point before the latest successful marker add, edit, discussion toggle, removal, clear or sidecar replacement. Captures the whole saved timeline and summary at that action. Typing summary alone does not create a recovery point. Preview all saved before/after text, then confirm to replace timeline and summary together. An empty previous review clears both. Restore consumes recovery, no redo or history.</p>
 <p>Current summary edits since that action will be replaced. Unadded marker draft, source, cursor, comparison and other reviews stay unchanged. Queue/search filters stay active and may hide restored notes. Earlier downloads and snapshots never update. Leaving or replacing the workspace loses recovery; export backups first. No authorship, completion or readiness proof.</p>
 <p>{previous?`Recovery available: ${previous.markers.length} previous markers; ${markers.length} current markers.`:'No previous saved instructor review in this session.'}</p>
 <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled||!previous} onClick={review}>Preview previous instructor review</button><button type="button" className={button} disabled={disabled||!preview} onClick={restore}>Confirm restore instructor review</button><button type="button" className={button} disabled={disabled||!preview} onClick={()=>{if(disabled)return;onPause();setPreview(null);setError('');}}>Discard instructor recovery preview</button></div>
 {preview&&<div aria-label="Instructor recovery before and after"><p>Recovery comparison below: Before is current saved review. After is the previous saved review to restore, not a newly imported file. Unadded drafts are retained, not included.</p><InstructorReplacement comparison={preview} draft="" recovery /></div>}{error&&<p role="alert" className="text-amber-300">{error} Current review and recovery kept.</p>}
 </section>;
}
