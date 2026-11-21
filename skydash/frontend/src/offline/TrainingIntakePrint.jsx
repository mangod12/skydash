import { useRef, useState } from 'react';
import { browserTrainingIntake } from '../utils/browserTrainingIntake';
export default function TrainingIntakePrint() {
  const [manifest, setManifest] = useState(null), [files, setFiles] = useState([]), [expected, setExpected] = useState('');
  const [result, setResult] = useState(null), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const manifestInput = useRef(null), filesInput = useRef(null), generation = useRef(0);
  const stale = () => { generation.current++; setResult(null); setStatus('Selection changed. Check all originals again before downloading.'); };
  const clear = () => {
    stale(); setManifest(null); setFiles([]); setExpected('');
    manifestInput.current.value = ''; filesInput.current.value = '';
    setStatus('Intake print selections cleared. Active replay workspace unchanged.');
  };
  const check = async () => {
    const ticket = ++generation.current; setBusy(true); setResult(null); setStatus('Checking every original locally. No report has been issued.');
    try { const checked = await browserTrainingIntake(manifest, files, expected); if (ticket === generation.current) { setResult(checked); setStatus('All originals checked. Privacy-reduced intake HTML is ready for explicit download. Not opened or shared.'); } }
    catch { if (ticket === generation.current) setStatus('Intake report refused. Check bounded original manifest, exact plain filenames/kinds, all and only listed originals, expected digests and nested models. No partial report. Private paths/content are not echoed.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = () => {
    if (!result || busy) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'skydash-training-intake.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Intake HTML download requested. Verify the saved file and inspect it locally. No automatic opening or sharing.');
  };
  const field = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 disabled:opacity-50';
  return <details className="shrink-0 border-b border-cyan-500/25 bg-zinc-950 text-xs text-zinc-200">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-cyan-200">Print a privacy-reduced package intake report locally</summary>
    <section aria-label="Privacy-reduced intake print tool" className="max-h-[65svh] overflow-y-auto px-4 pb-4">
      <p className="max-w-4xl">Check an original training manifest and every listed exported original without opening them into the replay workspace. No pause/seek, source replacement, annotation import or discarded work. No Node command, upload or automatic storage. This is separate from private debrief printing.</p>
      <p className="mt-2 max-w-4xl text-cyan-100">Output omits filenames, paths, titles, notes, marker text/IDs, criteria values, coordinates and individual readings. Hashes, counts, row bounds, times and source reuse remain sensitive, not anonymized. Review the audience yourself. Editable unsigned byte/model checks, not authenticated authorship, telemetry truth, flight/student identity, grades, completion or readiness.</p>
      <div className="mt-3 grid max-w-4xl gap-3 sm:grid-cols-2">
        <label>Original training manifest, at most64KiB<input aria-label="Intake print original manifest" ref={manifestInput} type="file" accept=".json,application/json" disabled={busy} className={field} onChange={e => { stale(); setManifest(e.target.files?.[0] || null); }} /></label>
        <label>All and only listed original JSON files<input aria-label="Intake print original files" ref={filesInput} type="file" multiple accept=".json,application/json" disabled={busy} className={field} onChange={e => { stale(); setFiles(Array.from(e.target.files || [])); }} /><span>{files.length} files selected. Plain exact filenames, no subfolders or ZIPs.</span></label>
        <label className="sm:col-span-2">Optional independent complete-manifest SHA-256<input aria-label="Intake print expected manifest SHA-256" value={expected} maxLength={64} autoComplete="off" spellCheck={false} disabled={busy} className={field+' font-mono'} onChange={e => { stale(); setExpected(e.target.value); }} /></label>
      </div>
      <p className="mt-2 max-w-4xl text-zinc-400">Explicit v1/v2 manifest,1to20 originals,20MiB combined; case/notebook2MiB each, paired4MiB. Optional raw-manifest expectation is checked before parsing, required artifact expectations before nested validation. Obtain expectations independently; co-delivered hashes do not authenticate themselves. Every original is checked before any HTML, output at most8MiB. No conversion-lineage check. Notebook originals require at least one applied saved copy.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !manifest || !files.length || (expected !== '' && !/^[a-fA-F0-9]{64}$/.test(expected))} onClick={check}>Check originals for intake print</button>
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !result} onClick={download}>Download privacy-reduced intake HTML</button>
        <button type="button" className="rounded border border-zinc-700 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={clear}>Clear intake print selections</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 max-w-4xl">{status}</p>
      {result && <p className="mt-2 max-w-4xl break-all font-mono">Complete manifest SHA-256: {result.digest}. {expected ? 'Caller-supplied expectation matched.' : 'No independent manifest expectation supplied.'}</p>}
      <p className="mt-2 max-w-4xl text-zinc-400">Download is explicit. Open the saved static HTML yourself and inspect browser print preview before printing or saving PDF. No scripts or external assets. Keep originals and excluded work separately. All intervals remain unsampled; unknown is not zero. Repeated source roles, artifacts and overlapping saved copies remain separate, never combined flights or totals. Closing this disclosure only hides it. Clear releases only these selections/results; refresh/tab close drops them. No source backup or complete handoff certificate.</p>
    </section>
  </details>;
}
