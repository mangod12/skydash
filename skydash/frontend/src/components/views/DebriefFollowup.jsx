import FollowupShelf from './FollowupShelf';
import { useState } from 'react';
import { FOLLOWUP_BYTES, FOLLOWUP_SCOPE, followupPacket, readFollowupPacket, followupReport } from '../../utils/debriefFollowup';
const button = 'rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-200 disabled:opacity-40';
export default function DebriefFollowup({ log, workspaceBusy = false, getSnapshot, onApply, onPause }) {
  const [reading, setReading] = useState(false), [pending, setPending] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const blocked = workspaceBusy || reading || Boolean(pending);
  const download = kind => {
    if (blocked) return; onPause(); setError(''); setMessage(''); let url;
    try {
      const snapshot = getSnapshot(), checked = followupPacket(log, snapshot.actions, snapshot.checklist);
      const value = kind === 'json' ? JSON.stringify(checked, null, 2) : followupReport(log, checked.actions, checked.checklist);
      url = URL.createObjectURL(new Blob([value], { type: kind === 'json' ? 'application/json' : 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-followup-${log.sha256.slice(0, 12)}.${kind === 'json' ? 'json' : 'txt'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('All saved actions and prompts downloaded together, independent of filters/pages. Includes private text/source identity; report adds original-row times/channel evidence, no coordinates. Keep exact CSV separately. Not a complete workspace backup.');
    } catch (failure) { if (url) URL.revokeObjectURL(url); setError(failure.message || 'Follow-up download could not start. Current reviews unchanged.'); }
  };
  const read = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || blocked) return; onPause(); setError(''); setMessage('');
    try { getSnapshot(); } catch (failure) { setError(failure.message || 'Finish or cancel current follow-up edits first.'); return; }
    setReading(true);
    try { if (file.size > FOLLOWUP_BYTES) throw new Error('Follow-up packet must be at most 512KiB.'); setPending(readFollowupPacket(new globalThis.TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()), log)); }
    catch (failure) { setError(failure.message || 'Follow-up packet could not be read. Both reviews unchanged.'); } finally { setReading(false); }
  };
  const apply = () => {
    if (workspaceBusy || reading || !pending) return; onPause(); setError('');
    try {
      // Recheck both child sections now, not just when import started. New edits during preview are never overwritten silently.
      getSnapshot(); const checked = readFollowupPacket(JSON.stringify(pending), log); onApply(checked); setPending(null); setMessage('Both follow-up sections replaced together in this session. Source, cursor and every other review unchanged. Imported status/outcomes are unverified.');
    } catch (failure) { setError(failure.message || 'Finish or cancel new follow-up edits before replacing both sections.'); }
  };
  return <article id="debrief-followup-packet" aria-label="Debrief follow-up packet" className="rounded-xl border border-fuchsia-500/25 p-4 space-y-3"><header><p className="text-[10px] tracking-widest text-fuchsia-300">TRAINING / TWO-SECTION FOLLOW-UP HANDOFF</p><h2 className="mt-1 text-lg text-zinc-100">Debrief follow-up packet</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{FOLLOWUP_SCOPE}</p></header>
    <p className="text-xs text-zinc-500">Download saved actions and discussion checklist together without embedding the CSV. Separate from portable review cases and device library. This is not a full workspace backup. Instructor markers/summary, analyst notes, envelope, windows/notebooks, circle review, comparison, mapping and playback state are excluded. Keep exact CSV and other reviews separately. Packet export/import/replacement checks both sections for unfinished drafts/imports/removal. Edits made during preview remain yours until explicit Replace; unfinished edits block replacement.</p>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={blocked} onClick={() => download('json')}>Download follow-up packet JSON</button><button className={button} disabled={blocked} onClick={() => download('report')}>Download combined follow-up report</button></div><label className="block min-w-0 text-xs text-zinc-400">Preview exact-source follow-up packet<input aria-label="Import follow-up packet JSON" type="file" accept=".json,application/json" disabled={blocked} className="mt-1 block w-full min-w-0 text-xs" onChange={read} /></label>
    {pending && <section aria-label="Follow-up packet import preview" className="rounded border border-amber-500/30 p-3 space-y-3 text-xs text-amber-200"><p>Exact source/models match, not authenticated authorship. Explicit Replace overwrites BOTH current saved action register and checklist title/prompts, including changes saved after preview began. Cancel keeps both current sections. Source/cursor/other reviews unchanged. Empty sections clear their respective saved list. All imported status/notes/closure are unverified.</p><p className="break-words whitespace-pre-wrap">Checklist title: {pending.checklist.title}. Imported {pending.actions.items.length} actions and {pending.checklist.items.length} prompts.</p>
      <h3>All imported action annotations</h3><ol aria-label="Packet action preview" className="max-h-64 overflow-y-auto space-y-2">{pending.actions.items.map(item => <li key={item.id} className="break-words whitespace-pre-wrap">Row {item.row} / {item.status}: {item.text}. Owner label: {item.owner || '(none)'}. Target text: {item.target || '(none)'}. Closure: {item.closure || '(none)'}</li>)}</ol>{!pending.actions.items.length && <p>No imported actions, replacement clears saved action register.</p>}
      <h3>All imported checklist annotations</h3><ol aria-label="Packet checklist preview" className="max-h-64 overflow-y-auto space-y-2">{pending.checklist.items.map(item => <li key={item.id} className="break-words whitespace-pre-wrap">{item.prompt}. Status: {item.status}. Original row: {item.row ?? 'none'}. Note/reason: {item.note || '(none)'}</li>)}</ol>{!pending.checklist.items.length && <p>No imported prompts, replacement clears saved checklist prompts.</p>}
      <div className="flex flex-wrap gap-2"><button className={button} disabled={workspaceBusy || reading} onClick={apply}>Replace both follow-up sections</button><button className={button} disabled={workspaceBusy || reading} onClick={() => { setPending(null); setError(''); setMessage('Packet import canceled. Both current sections kept, including edits made during preview.'); }}>Keep current follow-up sections</button></div></section>}
    <FollowupShelf log={log} getSnapshot={getSnapshot} onPreview={data => { setPending(data); setError(''); setMessage('Stored packet preview ready. Current sections unchanged.'); }} onPause={onPause} disabled={blocked} />
    {reading && <p role="status" className="text-xs text-fuchsia-200">Reading follow-up packet. Both current reviews unchanged.</p>}<p className="text-xs text-zinc-500">512KiB strict UTF-8/known fields/models/exact-source validation. No imported metrics accepted; report evidence recomputed from loaded source. JSON has no coordinates/CSV, but private annotations can mention sensitive places/people. Current edits are session-only unless explicitly saved to the local shelf below; source/review revision clears this preview. Matching hashes authenticate neither author nor completion. Editable, not signed or tamper-evident. No automatic storage/upload/sharing/backend writes/tasks/notifications or aircraft commands.</p>{error && <p role="alert" className="text-xs text-amber-300">{error}</p>}{message && <p role="status" className="text-xs text-fuchsia-200">{message}</p>}
  </article>;
}
