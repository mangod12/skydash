import { forwardRef, useImperativeHandle, useState } from 'react';
import { BookmarkPlus, Download } from 'lucide-react';
import { recordedObservation } from '../../utils/flightComparison';
import { MAX_MARKERS, MAX_DEBRIEF_BYTES, MARKER_KINDS, DEBRIEF_SCOPE, createReviewMarker, validateMarkers, debriefSidecar, readDebriefSidecar, instructorReport } from '../../utils/instructorDebrief';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed';
const input = 'mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200';
const InstructorDebrief = forwardRef(function InstructorDebrief({ log, time, onSeek, onPause, initialReview = null }, ref) {
  const [markers, setMarkers] = useState(initialReview?.markers || []);
  const [kind, setKind] = useState('Observation');
  const [text, setText] = useState('');
  const [notes, setNotes] = useState(initialReview?.notes || '');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  useImperativeHandle(ref, () => ({ snapshot() {
    if (busy || pending) throw new Error('Finish or cancel the debrief import before exporting a case.');
    if (text.trim()) throw new Error('Add or clear the unadded instructor marker note before exporting a case.');
    return debriefSidecar(log, markers, notes);
  } }));
  const context = recordedObservation(log.samples, time);
  const add = event => {
    event.preventDefault(); onPause(); setError(''); setMessage('');
    try {
      if (markers.length >= MAX_MARKERS) throw new Error('Review is full. At most 100 markers are supported.');
      const marker = createReviewMarker(log, { id: globalThis.crypto.randomUUID(), time_s: time, kind, text });
      setMarkers(previous => validateMarkers([...previous, marker], log.samples.at(-1).time_s)); setText(''); setMessage(`Review marker added at ${time.toFixed(1)}s. It is an instructor note, not a detected event.`);
    } catch (failure) { setError(failure.message || 'Marker could not be added.'); }
  };
  const read = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy) return;
    onPause(); setBusy(true); setPending(null); setError(''); setMessage('');
    try {
      if (file.size > MAX_DEBRIEF_BYTES) throw new Error('Debrief JSON must be at most 256KiB.');
      const data = readDebriefSidecar(new globalThis.TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()), log);
      setPending(data); setMessage('Matching source fingerprint and marker bounds checked. Imported notes are unverified. Confirm replacement to apply them.');
    } catch (failure) { setError(failure.message || 'Debrief file could not be read.'); }
    finally { setBusy(false); }
  };
  const apply = () => { setMarkers(pending.markers); setNotes(pending.notes); setPending(null); setText(''); setConfirmClear(false); setMessage('Debrief imported locally. Sample context is recomputed from the current source; annotation authorship is not verified.'); };
  const download = format => {
    let url;
    try {
      const sidecar = format === 'json';
      const contents = sidecar ? JSON.stringify(debriefSidecar(log, markers, notes), null, 2) : instructorReport(log, markers, notes);
      url = URL.createObjectURL(new Blob([contents], { type: sidecar ? 'application/json' : 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-instructor-${log.sha256.slice(0, 12)}.${sidecar ? 'json' : 'txt'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError('');
      setMessage('Download requested. Keep the JSON sidecar and exact source CSV to reopen this review. Report includes source coordinates and review notes.');
    } catch (failure) { if (url) URL.revokeObjectURL(url); setError(failure.message?.includes('256KiB') ? failure.message : 'Debrief download could not start. Markers and notes remain in this session.'); }
  };
  return <article id="instructor-debrief" aria-label="Instructor debrief timeline" className="rounded-xl border border-emerald-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-emerald-300">TRAINING / FACILITATED REVIEW</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">Instructor debrief timeline</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{DEBRIEF_SCOPE}</p></header>
    <p className="text-xs text-zinc-500 break-all">Source fingerprint: {log.sha256}. Notes are session-only. Changing the source clears this timeline. Save to server stores the CSV review only, not these markers. This is not a signed instructor record.</p>
    <form onSubmit={add} className="rounded-lg border border-white/10 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p aria-label="Marker source context" className="text-xs text-zinc-300">Cursor {time.toFixed(1)}s / source sample {context.sample.time_s}s / age {context.ageS.toFixed(1)}s {context.state === 'gap' ? '/ missing interval, held sample' : ''}</p><button type="button" onClick={() => { onPause(); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} className={button}>Seek in replay</button></div>
      <label className="block text-xs text-zinc-400">Marker kind<select aria-label="Marker kind" value={kind} onChange={event => setKind(event.target.value)} className={input}>{MARKER_KINDS.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-xs text-zinc-400">Instructor marker note<textarea aria-label="Instructor marker note" rows={2} maxLength={1000} value={text} onFocus={onPause} onChange={event => setText(event.target.value)} className={input} /></label>
      <button type="submit" disabled={busy || !text.trim() || markers.length >= MAX_MARKERS} className={button}><BookmarkPlus size={14} /> Add marker at cursor</button>
    </form>
    {error && <p role="alert" className="text-xs text-amber-300">{error} Existing review has not been replaced.</p>}{message && <p role="status" className="text-xs text-emerald-200">{message}</p>}
    <h3 className="text-sm font-semibold text-zinc-200">Review timeline ({markers.length}/100)</h3>
    {!markers.length && <p className="text-xs text-zinc-500">Pause or scrub replay above, then add an observation, question or follow-up. Markers are sorted by elapsed time.</p>}
    <ol className="space-y-2" aria-label="Instructor review markers">{markers.map(marker => {
      const evidence = recordedObservation(log.samples, marker.time_s);
      return <li key={marker.id} className="rounded-lg border border-white/10 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => onSeek(marker.time_s)} className={button}>Jump to {marker.time_s.toFixed(1)}s</button><span className="text-[10px] text-emerald-300">{marker.kind}</span></div>
        <p className="whitespace-pre-wrap break-words text-xs text-zinc-300">{marker.text}</p>
        <p className={`text-[10px] ${evidence.state === 'gap' ? 'text-amber-300' : 'text-zinc-500'}`}>Source sample {evidence.sample.time_s}s, age {evidence.ageS.toFixed(1)}s. {evidence.state === 'gap' ? 'DATA GAP. No observation at marker time.' : 'Context is the latest observation at or before marker time.'}</p>
        <div className="flex flex-wrap items-center justify-between gap-2"><label className="inline-flex gap-2 items-center text-xs text-zinc-400"><input type="checkbox" checked={marker.discussed} onChange={event => setMarkers(previous => previous.map(item => item.id === marker.id ? { ...item, discussed: event.target.checked } : item))} /> Discussed at {marker.time_s.toFixed(1)}s</label><button type="button" onClick={() => { setMarkers(previous => previous.filter(item => item.id !== marker.id)); setMessage('Marker removed locally. Exported files are unchanged.'); }} className="text-xs text-zinc-500 hover:text-zinc-200">Remove marker at {marker.time_s.toFixed(1)}s</button></div>
      </li>;
    })}</ol>
    <p className="text-[10px] text-zinc-500">Discussed is a facilitation checkbox, not passed/failed or a competence assessment. Removal changes only this session. A new export is needed after edits.</p>
    <label className="block text-xs text-zinc-400">Discussion summary<textarea aria-label="Discussion summary" rows={3} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} className={input} /></label>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => download('report')} className={button}><Download size={14} /> Download instructor report</button><button type="button" disabled={busy} onClick={() => download('json')} className={button}><Download size={14} /> Download debrief JSON</button><button type="button" disabled={busy || !markers.length && !notes} onClick={() => setConfirmClear(value => !value)} className={button}>Clear instructor review</button></div>
    {confirmClear && <div className="text-xs text-amber-300">Clear all markers and discussion summary from this session? Download first to keep them.<div className="mt-2 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { setMarkers([]); setNotes(''); setText(''); setConfirmClear(false); setPending(null); setMessage('Instructor review cleared locally. Source CSV and saved records are unchanged.'); }}>Confirm clear review</button><button type="button" className={button} onClick={() => setConfirmClear(false)}>Keep review</button></div></div>}
    <div className="border-t border-white/10 pt-3 space-y-2"><h3 className="text-sm font-semibold text-zinc-200">Reopen a debrief sidecar</h3><p className="text-xs text-zinc-500">Load the matching source CSV first. JSON contains notes, marker times and source fingerprint, not the CSV. A valid sidecar still has unverified authorship. Confirm before replacing the current review. Up to 256KiB / 100 markers.</p><input aria-label="Import debrief JSON" type="file" accept=".json,application/json" disabled={busy} onChange={read} className="block w-full min-w-0 text-xs text-zinc-400" /></div>
    {pending && <div className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-300">Matching sidecar: {pending.markers.length} markers. Replace current {markers.length} markers and summary? Source CSV is unchanged.<div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={apply} className={button}>Replace with imported review</button><button type="button" onClick={() => { setPending(null); setMessage('Import cancelled. Current review kept.'); }} className={button}>Keep current review</button></div></div>}
  </article>;
});
export default InstructorDebrief;
