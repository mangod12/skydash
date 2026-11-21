import ReceivedArchiveComparison from './ReceivedArchiveComparison';
import { useRef, useState } from 'react';
import { browserTrainingComparison } from '../utils/browserTrainingComparison';
const empty = () => ({ manifest: null, files: [], expected: '' });
export default function TrainingComparisonPrint() {
  const [left, setLeft] = useState(empty), [right, setRight] = useState(empty);
  const [result, setResult] = useState(null), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0), inputs = useRef({});
  const stale = () => { generation.current++; setResult(null); setStatus('Selection changed. Check both complete original packages again.'); };
  const edit = (side, field, value) => { stale(); (side === 'Left' ? setLeft : setRight)(state => ({ ...state, [field]: value })); };
  const clear = () => { stale(); setLeft(empty()); setRight(empty()); for (const input of Object.values(inputs.current)) if (input) input.value = ''; setStatus('Comparison print selections cleared. Active replay workspace unchanged.'); };
  const check = async () => {
    const ticket = ++generation.current; setBusy(true); setResult(null); setStatus('Checking both complete original packages locally. No comparison issued yet.');
    try { const checked = await browserTrainingComparison(left, right); if (ticket === generation.current) { setResult(checked); setStatus('Both packages checked. Privacy-reduced comparison HTML is ready for explicit download. Not opened or shared.'); } }
    catch { if (ticket === generation.current) setStatus('Package comparison refused. Check both bounded manifests, independent expectations, exact plain filenames and all originals with valid nested models. No partial report or private diagnostics.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = () => {
    if (!result || busy) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'skydash-package-comparison.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Comparison HTML download requested. Verify the saved output and inspect it locally. No automatic opening or sharing.');
  };
  const ready = side => side.manifest && side.files.length && (side.expected === '' || /^[a-fA-F0-9]{64}$/.test(side.expected));
  const field = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 disabled:opacity-50';
  return <details className="shrink-0 border-b border-cyan-500/25 bg-zinc-950 text-xs text-zinc-200">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-cyan-200">Compare two original package snapshots locally</summary>
    <section aria-label="Original package comparison print tool" className="max-h-[65svh] overflow-y-auto px-4 pb-4">
      <p className="max-w-4xl">Choose Left and Right original training manifests and all originals on each side. These are caller-selected snapshots, not verified earlier/later revisions. Both packages must pass current original source/model/review and byte checks before any result. No replay pause/seek, workspace source replacement, annotation transfer or discarded work.</p>
      <p className="mt-2 max-w-4xl text-cyan-100">Privacy-reduced output omits filenames, paths, titles, notes, marker text/IDs, criteria, coordinates and individual readings. Hashes, occurrence counts and role/reuse patterns remain sensitive, not anonymized. Not authenticated authorship/custody, source truth, flight/student identity, grades, completion or readiness. Equal CSV occurrences can conceal different review artifacts, order or roles.</p>
      <div className="mt-3 grid max-w-4xl gap-4 sm:grid-cols-2">{[['Left', left], ['Right', right]].map(([side, state]) => <fieldset key={side} disabled={busy} className="min-w-0 rounded border border-zinc-700 p-3">
        <legend className="px-1 font-semibold">{side} original package</legend>
        <label className="block">{side} manifest, at most64KiB<input aria-label={side+' comparison original manifest'} ref={node => { inputs.current[side+'manifest'] = node; }} type="file" accept=".json,application/json" className={field} onChange={e => edit(side, 'manifest', e.target.files?.[0] || null)} /></label>
        <label className="mt-3 block">{side} all and only original JSON files<input aria-label={side+' comparison original files'} ref={node => { inputs.current[side+'files'] = node; }} type="file" multiple accept=".json,application/json" className={field} onChange={e => edit(side, 'files', Array.from(e.target.files || []))} /><span>{state.files.length} selected. Exact plain filenames, no folders or ZIPs.</span></label>
        <label className="mt-3 block">{side} optional independent complete-manifest SHA-256<input aria-label={side+' comparison expected manifest SHA-256'} value={state.expected} maxLength={64} autoComplete="off" spellCheck={false} className={field+' font-mono'} onChange={e => edit(side, 'expected', e.target.value)} /></label>
      </fieldset>)}</div>
      <p className="mt-2 max-w-4xl text-zinc-400">Each side: explicit v1/v2,1to20 originals,20MiB total, case/notebook2MiB or paired4MiB each. Combined at most40MiB plus two manifests. Same filenames on opposite sides stay separate. Optional raw-manifest pins are checked before parsing; artifact pins are required before nested validation and repinned before projection. Obtain expectations independently, not from co-delivered hashes. No imported success receipts. HTML at most8MiB. All input edits invalidate old results, even if reverted.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !ready(left) || !ready(right)} onClick={check}>Check both packages for comparison</button>
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !result} onClick={download}>Download package comparison HTML</button>
        <button type="button" className="rounded border border-zinc-700 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={clear}>Clear comparison print selections</button>
      </div>
      <ReceivedArchiveComparison />
      <p role="status" aria-live="polite" className="mt-3 max-w-4xl">{status}</p>
      {result && <div className="mt-2 max-w-4xl break-all font-mono"><p>Left complete-manifest SHA-256: {result.leftDigest}. {left.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>Right complete-manifest SHA-256: {result.rightDigest}. {right.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p></div>}
      <p className="mt-2 max-w-4xl text-zinc-400">Report shows exact manifest agreement, ordered artifact sequence and every artifact/source-role occurrence, not annotation edits or guessed pairs. Absent exact bytes do not prove added/deleted or missing work. No combined samples, spans, flights, grades or completion totals, source repair, merge, patch or conversion-lineage check. No source backup or complete handoff certificate. Download is explicit; open saved static HTML yourself and inspect print preview/audience. No scripts/external assets, automatic opening, storage, upload or sharing. Clear releases only these print selections/results, closing the disclosure only hides them. Refresh/tab close drops them; preserve originals and excluded work separately.</p>
    </section>
  </details>;
}
