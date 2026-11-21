import { useRef, useState } from 'react';
import { browserTrainingLineage } from '../utils/browserTrainingLineage';
const empty = () => ({ manifest: null, files: [], expected: '' });
export default function TrainingLineagePrint() {
  const [training, setTraining] = useState(empty), [lineage, setLineage] = useState(empty), [ack, setAck] = useState(false), [requireAll, setRequireAll] = useState(false);
  const [result, setResult] = useState(null), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0), inputs = useRef({});
  const stale = () => { generation.current++; setResult(null); setAck(false); setStatus('Selection changed. Confirm all original coordinates again and recheck every original.'); };
  const edit = (side, key, value) => { stale(); (side === 'Training' ? setTraining : setLineage)(state => ({ ...state, [key]: value })); };
  const clear = () => { stale(); setTraining(empty()); setLineage(empty()); setRequireAll(false); for (const input of Object.values(inputs.current)) if (input) input.value = ''; setStatus('Lineage print selections cleared. Active replay workspace unchanged.'); };
  const check = async () => {
    const ticket = ++generation.current; setBusy(true); setResult(null); setAck(false); setStatus('Reproducing every conversion and checking every original locally. No report issued yet.');
    try { const checked = await browserTrainingLineage(training, lineage, { confirmedWGS84: ack, requireAllReviewSources: requireAll }); if (ticket === generation.current) { setResult(checked); setStatus('All originals checked. Privacy-reduced source-link HTML ready for explicit download. Confirmation consumed; a new check needs fresh confirmation.'); } }
    catch { if (ticket === generation.current) setStatus('Lineage intake refused. Check both original manifests, exact plain filenames, all expected raw-file digests, conversion recipes, nested review models and requested coverage. No partial report or private diagnostics.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = () => {
    if (!result || busy) return;
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'skydash-training-source-links.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Source-link HTML download requested. Verify the saved file and inspect it locally. No automatic opening or sharing.');
  };
  const ready = side => side.manifest && side.files.length && (side.expected === '' || /^[a-fA-F0-9]{64}$/.test(side.expected));
  const field = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 disabled:opacity-50';
  return <details className="shrink-0 border-b border-cyan-500/25 bg-zinc-950 text-xs text-zinc-200">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-cyan-200">Check conversion links to original review sources locally</summary>
    <section aria-label="Original training source-link print tool" className="max-h-[65svh] overflow-y-auto px-4 pb-4">
      <p className="max-w-4xl">Select the original training package and a separate original conversion-lineage manifest with every original CSV, recipe and exact converted CSV it lists. Reproduce every conversion with current validators, check all original review artifacts, then link only exact converted CSV bytes to each ordered review-source role. No imported success receipts or automatic pairing by filename, label or local ID.</p>
      <p className="mt-2 max-w-4xl text-cyan-100">Multiple relations yielding identical converted bytes remain separate, never a unique original, aircraft, flight or person. Unlinked sources may be native CSV or missing lineage, not failed/missing work. Repeated roles and artifacts are not independent flights or completions. No summed samples, spans, grades or completion totals. Fresh coordinate confirmation is your statement, not source truth, trusted units/datum, OEM compatibility, authorship/custody or readiness.</p>
      <div className="mt-3 grid max-w-4xl gap-4 sm:grid-cols-2">{[['Training', training], ['Lineage', lineage]].map(([side, state]) => <fieldset key={side} disabled={busy} className="min-w-0 rounded border border-zinc-700 p-3">
        <legend className="px-1 font-semibold">{side} original selection</legend>
        <label className="block">{side} manifest, at most64KiB<input aria-label={side+' source-link manifest'} ref={node => { inputs.current[side+'manifest'] = node; }} type="file" accept=".json,application/json" className={field} onChange={e => edit(side, 'manifest', e.target.files?.[0] || null)} /></label>
        <label className="mt-3 block">{side} all and only listed original files<input aria-label={side+' source-link original files'} ref={node => { inputs.current[side+'files'] = node; }} type="file" multiple className={field} onChange={e => edit(side, 'files', Array.from(e.target.files || []))} /><span>{state.files.length} selected. Exact plain filenames, no folders or ZIPs.</span></label>
        <label className="mt-3 block">{side} optional independent complete-manifest SHA-256<input aria-label={side+' source-link expected SHA-256'} value={state.expected} maxLength={64} autoComplete="off" spellCheck={false} className={field+' font-mono'} onChange={e => edit(side, 'expected', e.target.value)} /></label>
      </fieldset>)}</div>
      <label className="mt-3 flex max-w-4xl items-start gap-2"><input aria-label="Require every review-source role linked" type="checkbox" checked={requireAll} disabled={busy} onChange={e => { stale(); setRequireAll(e.target.checked); }} />Refuse the whole report unless every listed review-source role has at least one exact reproduced relation.</label>
      <label className="mt-3 flex max-w-4xl items-start gap-2"><input aria-label="Fresh all-original WGS84 confirmation" type="checkbox" checked={ack} disabled={busy} onChange={e => { generation.current++; setResult(null); setStatus('Confirmation changed. Recheck every original.'); setAck(e.target.checked); }} />I freshly confirm every listed original's latitude/longitude columns are WGS84 decimal degrees. I will inspect source units myself. Neither manifest nor any recipe can supply this confirmation.</label>
      <p className="mt-2 max-w-4xl text-zinc-400">Training: v1/v2,1to20 JSON originals,2MiB case/notebook or4MiB paired. Lineage: v1,1to20 relations,60 unique plain files, CSV1MiB each/recipe64KiB. Each selection owns20MiB, combined40MiB plus two64KiB manifests. Names on opposite selections stay separate. Optional raw-manifest pins checked before parsing, required artifact/conversion pins before nested validation. Obtain expectations independently; co-delivered hashes do not authenticate themselves. Every edit invalidates output and resets confirmation, even if reverted. Each check consumes confirmation, including failure. HTML at most8MiB.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !ack || !ready(training) || !ready(lineage)} onClick={check}>Check originals and conversion links</button>
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !result} onClick={download}>Download source-link intake HTML</button>
        <button type="button" className="rounded border border-zinc-700 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={clear}>Clear lineage print selections</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 max-w-4xl">{status}</p>
      {result && <div className="mt-2 max-w-4xl break-all font-mono"><p>Training manifest SHA-256: {result.trainingDigest}. {training.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>Lineage manifest SHA-256: {result.lineageDigest}. {lineage.expected ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p><p>{result.allLinked ? 'Every listed review-source role has an exact reproduced relation.' : 'Some review-source roles have no exact reproduced relation. No origin inferred.'}</p></div>}
      <p className="mt-2 max-w-4xl text-zinc-400">Static privacy-reduced HTML omits paths, filenames, headers, recipe labels, notes, coordinates and readings. Hashes, counts, times and reuse/link patterns remain sensitive, not anonymized. Inspect the saved report, audience and print preview yourself. No scripts/external assets, automatic download/opening, storage, upload or sharing. No source repair, converted CSV save, annotation transfer, workspace import, pause/seek or discarded work. Clear releases only this tool; closing hides results, refresh/tab close drops them. Keep all originals and excluded work separately. Editable unsigned output is not a source/recipe backup, reopenable workspace, authenticated history, completion, certification or complete handoff certificate.</p>
    </section>
  </details>;
}
