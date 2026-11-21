import { useRef, useState } from 'react';
import { browserReviewComparison } from '../utils/browserReviewComparison';
const empty = () => ({ file: null, expected: '' });
export default function ReviewComparisonPrint() {
  const [kind, setKind] = useState('notebook');
  const [left, setLeft] = useState(empty), [right, setRight] = useState(empty);
  const [result, setResult] = useState(null), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0), inputs = useRef({});
  const stale = () => { generation.current++; setResult(null); setStatus('Selection changed. Check both original notebook or paired reviews again.'); };
  const edit = (side, field, value) => { stale(); (side === 'Left' ? setLeft : setRight)(state => ({ ...state, [field]: value })); };
  const clear = () => { stale(); setLeft(empty()); setRight(empty()); for (const input of Object.values(inputs.current)) if (input) input.value = ''; setStatus('Review comparison selections cleared. Active replay workspace unchanged.'); };
  const check = async () => {
    const ticket = ++generation.current; setBusy(true); setResult(null); setStatus('Checking both complete original reviews locally. No report issued yet.');
    try { const checked = await browserReviewComparison(kind, left, right); if (ticket === generation.current) { setResult(checked); setStatus('Both original reviews checked. Privacy-reduced HTML ready for explicit download, not opened or shared.'); } }
    catch { if (ticket === generation.current) setStatus('Original review comparison refused. Check both bounded UTF-8 originals, independent expectations and nested source/model/review bounds. No partial report or private diagnostics.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = () => {
    if (!result || busy) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'skydash-'+kind+'-comparison.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Review comparison HTML download requested. Verify the saved file and inspect it locally. No automatic opening or sharing.');
  };
  const ready = side => side.file && (side.expected === '' || /^[a-fA-F0-9]{64}$/.test(side.expected));
  const field = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 disabled:opacity-50';
  return <details className="shrink-0 border-b border-cyan-500/25 bg-zinc-950 text-xs text-zinc-200">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-cyan-200">Compare two original notebook or paired reviews locally</summary>
    <section aria-label="Original notebook or paired comparison print tool" className="max-h-[65svh] overflow-y-auto px-4 pb-4">
      <p className="max-w-4xl">Explicitly choose Notebook or Paired, then two complete original exports of that same kind. Left/Right are selected snapshots, not verified earlier/later revisions or automatically paired from packages/filenames. Both current nested validators must pass before one result. No replay pause/seek, source replacement, review import or discarded work.</p>
      <p className="mt-2 max-w-4xl text-cyan-100">Notebook: exact source CSV bytes gate all saved-copy associations. Editable local IDs associate ordinal references, not verified copy identity or edit history. Side-only ordinals do not prove added/deleted/missing work, even for identical text. Paired: exact primary bytes gate primary-review flags; exact ordered primary AND baseline bytes gate comparison notes and applied anchors. Changed baseline alone does not block primary flags. No role swapping, event pairing or annotation transfer.</p>
      <label className="mt-3 block max-w-sm">Explicit original review kind<select aria-label="Original review comparison kind" value={kind} disabled={busy} className={field} onChange={e => { stale(); setKind(e.target.value); setLeft(empty()); setRight(empty()); for (const input of Object.values(inputs.current)) if (input) input.value = ''; }}><option value="notebook">Notebook source bundle</option><option value="paired">Paired review bundle</option></select></label>
      <div className="mt-3 grid max-w-4xl gap-4 sm:grid-cols-2">{[['Left', left], ['Right', right]].map(([side, state]) => <fieldset key={side} disabled={busy} className="min-w-0 rounded border border-zinc-700 p-3">
        <legend className="px-1 font-semibold">{side} original review</legend>
        <label className="block">{side} complete {kind} JSON, at most{kind === 'paired' ? '4' : '2'}MiB<input aria-label={side+' review comparison original'} ref={node => { inputs.current[side] = node; }} type="file" accept=".json,application/json" className={field} onChange={e => edit(side, 'file', e.target.files?.[0] || null)} /></label>
        <label className="mt-3 block">{side} optional independent complete-artifact SHA-256<input aria-label={side+' review comparison expected SHA-256'} value={state.expected} maxLength={64} autoComplete="off" spellCheck={false} className={field+' font-mono'} onChange={e => edit(side, 'expected', e.target.value)} /></label>
      </fieldset>)}</div>
      <p className="mt-2 max-w-4xl text-zinc-400">Notebook2MiB each/4MiB combined; paired4MiB each/8MiB combined; HTML at most8MiB. Optional raw-file pins checked before parsing that original. Obtain expectations independently; co-delivered hashes do not authenticate themselves. Both originals required, never imported receipts/reports. Every kind/file/hash edit invalidates old output even reverted. Inputs lock during checks.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !ready(left) || !ready(right)} onClick={check}>Check both original notebook or paired reviews</button>
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !result} onClick={download}>Download notebook or paired comparison HTML</button>
        <button type="button" className="rounded border border-zinc-700 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={clear}>Clear notebook or paired comparison selections</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 max-w-4xl">{status}</p>
      {result && <div className="mt-2 max-w-4xl break-all font-mono"><p>Left complete-artifact SHA-256: {result.leftDigest}. {left.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>Right complete-artifact SHA-256: {result.rightDigest}. {right.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>Source gates and suppressed flags are retained in the report. Inspect every section.</p></div>}
      <p className="mt-2 max-w-4xl text-zinc-400">Static escaped HTML omits filenames, paths, titles, notes, marker IDs/text, criteria, coordinates and individual readings. Hashes/change patterns remain sensitive, not anonymized. Verify the saved output, print preview and audience yourself. No scripts/external assets, automatic download/opening, storage, upload, sharing, patches, merges, review transfer or source repairs. Clear releases only these selections/results, closing hides them; refresh/tab close drops them. Preserve originals and excluded work separately. Editable unsigned flags are not authenticated history, authorship/custody, source truth, flight/student identity, grades, completion, certification or readiness. Hashes/counts/change patterns remain sensitive; no row bounds or individual marker/anchor values are printed. Not a source backup, reopenable workspace or complete handoff certificate.</p>
    </section>
  </details>;
}
