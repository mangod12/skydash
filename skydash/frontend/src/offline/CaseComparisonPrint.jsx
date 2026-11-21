import { useRef, useState } from 'react';
import { browserCaseComparison } from '../utils/browserCaseComparison';
const empty = () => ({ file: null, expected: '' });
export default function CaseComparisonPrint() {
  const [left, setLeft] = useState(empty), [right, setRight] = useState(empty);
  const [result, setResult] = useState(null), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0), inputs = useRef({});
  const stale = () => { generation.current++; setResult(null); setStatus('Selection changed. Check both original cases again.'); };
  const edit = (side, field, value) => { stale(); (side === 'Left' ? setLeft : setRight)(state => ({ ...state, [field]: value })); };
  const clear = () => { stale(); setLeft(empty()); setRight(empty()); for (const input of Object.values(inputs.current)) if (input) input.value = ''; setStatus('Case comparison selections cleared. Active replay workspace unchanged.'); };
  const check = async () => {
    const ticket = ++generation.current; setBusy(true); setResult(null); setStatus('Checking both complete original cases locally. No report issued yet.');
    try { const checked = await browserCaseComparison(left, right); if (ticket === generation.current) { setResult(checked); setStatus('Both original cases checked. Privacy-reduced HTML ready for explicit download, not opened or shared.'); } }
    catch { if (ticket === generation.current) setStatus('Case comparison refused. Check both bounded UTF-8 originals, independent expectations and nested source/model/review bounds. No partial report or private diagnostics.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = () => {
    if (!result || busy) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'skydash-case-comparison.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Case comparison HTML download requested. Verify the saved file and inspect it locally. No automatic opening or sharing.');
  };
  const ready = side => side.file && (side.expected === '' || /^[a-fA-F0-9]{64}$/.test(side.expected));
  const field = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 disabled:opacity-50';
  return <details className="shrink-0 border-b border-cyan-500/25 bg-zinc-950 text-xs text-zinc-200">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-cyan-200">Compare two original case reviews locally</summary>
    <section aria-label="Original case comparison print tool" className="max-h-[65svh] overflow-y-auto px-4 pb-4">
      <p className="max-w-4xl">Choose two complete original case exports explicitly. Left/Right are selected snapshots, not verified earlier/later revisions. No automatic pairing from a package, labels or filenames. Both current source/model/marker-bound/envelope validators must pass before one report. No replay pause/seek, workspace source replacement, review import or discarded work.</p>
      <p className="mt-2 max-w-4xl text-cyan-100">Only exact embedded CSV byte equality permits review section flags. Changed source bytes suppress every review flag, even with matching IDs or text. Whole normalized marker arrays are compared, never paired as individual events. Flags do not disclose changed private words or prove missing work, authenticated edits, authorship/custody, telemetry truth, flight/student identity, completion, grades or readiness.</p>
      <div className="mt-3 grid max-w-4xl gap-4 sm:grid-cols-2">{[['Left', left], ['Right', right]].map(([side, state]) => <fieldset key={side} disabled={busy} className="min-w-0 rounded border border-zinc-700 p-3">
        <legend className="px-1 font-semibold">{side} original case</legend>
        <label className="block">{side} complete case JSON, at most2MiB<input aria-label={side+' case comparison original'} ref={node => { inputs.current[side] = node; }} type="file" accept=".json,application/json" className={field} onChange={e => edit(side, 'file', e.target.files?.[0] || null)} /></label>
        <label className="mt-3 block">{side} optional independent complete-case SHA-256<input aria-label={side+' case comparison expected SHA-256'} value={state.expected} maxLength={64} autoComplete="off" spellCheck={false} className={field+' font-mono'} onChange={e => edit(side, 'expected', e.target.value)} /></label>
      </fieldset>)}</div>
      <p className="mt-2 max-w-4xl text-zinc-400">At most4MiB combined input and8MiB HTML. Each optional raw-file pin is checked before parsing that original. Obtain expectations independently; co-delivered hashes do not authenticate themselves. Both originals are required, never imported receipts/reports. Every file/hash edit invalidates old output even when reverted. Inputs lock during checking.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !ready(left) || !ready(right)} onClick={check}>Check both original cases</button>
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !result} onClick={download}>Download case comparison HTML</button>
        <button type="button" className="rounded border border-zinc-700 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={clear}>Clear case comparison selections</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 max-w-4xl">{status}</p>
      {result && <div className="mt-2 max-w-4xl break-all font-mono"><p>Left complete-case SHA-256: {result.leftDigest}. {left.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>Right complete-case SHA-256: {result.rightDigest}. {right.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>{result.sourceEqual ? 'Exact source CSV bytes agree. Review section flags compared.' : 'Source CSV bytes differ. Every review section flag suppressed.'}</p></div>}
      <p className="mt-2 max-w-4xl text-zinc-400">Static escaped HTML omits filenames, paths, titles, notes, marker IDs/text, criteria, coordinates and individual readings. Hashes/change patterns remain sensitive, not anonymized. Verify the saved output, print preview and audience yourself. No scripts/external assets, automatic download/opening, storage, upload, sharing, patches, merges, review transfer or source repairs. Clear releases only these selections/results, closing hides them; refresh/tab close drops them. Preserve originals and excluded notebook/comparison work separately. Not a source backup, reopenable workspace or complete handoff certificate.</p>
    </section>
  </details>;
}
