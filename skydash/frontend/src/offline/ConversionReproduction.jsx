import { useRef, useState } from 'react';
import { browserConversionReproduction } from '../utils/browserConversionReproduction';
const roles = ['original', 'recipe', 'converted'];
const empty = () => Object.fromEntries(roles.map(role => [role, { file: null, expected: '' }]));
export default function ConversionReproduction() {
  const [selection, setSelection] = useState(empty), [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [result, setResult] = useState(null), [status, setStatus] = useState('');
  const inputs = useRef({}), generation = useRef(0);
  const stale = () => { generation.current++; setResult(null); setStatus('Selection changed. Check the three complete files again.'); };
  const edit = (role, field, value) => { stale(); setAck(false); setSelection(state => ({ ...state, [role]: { ...state[role], [field]: value } })); };
  const clear = () => { stale(); setSelection(empty()); setAck(false); for (const input of Object.values(inputs.current)) if (input) input.value = ''; setStatus('Conversion check selections cleared. Active replay workspace unchanged.'); };
  const check = async () => {
    const ticket = ++generation.current; setBusy(true); setResult(null); setAck(false); setStatus('Checking raw bytes and reproducing conversion locally. No receipt issued yet.');
    try { const receipt = await browserConversionReproduction(Object.fromEntries(roles.map(role => [role, selection[role].file])), { confirmedWGS84: ack, expected: Object.fromEntries(roles.map(role => [role, selection[role].expected])) }); if (ticket === generation.current) { setResult(receipt); setStatus('Converted bytes reproduced exactly. Privacy-reduced receipt is ready for explicit download. Confirmation consumed; any new check requires fresh confirmation.'); } }
    catch { if (ticket === generation.current) setStatus('Conversion reproduction refused. Check bounded UTF-8 originals, exact recipe headers/models/units, raw-file expectations, fresh coordinate confirmation and exact converted bytes. No receipt or private diagnostics.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = () => {
    if (!result || busy) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)+'\n'], { type: 'application/json;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'skydash-conversion-check.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Conversion receipt download requested. Verify the saved file. No automatic opening or sharing. Keep all three original files separately.');
  };
  const valid = roles.every(role => selection[role].file && (selection[role].expected === '' || /^[a-fA-F0-9]{64}$/.test(selection[role].expected)));
  const field = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 disabled:opacity-50';
  return <details className="shrink-0 border-b border-cyan-500/25 bg-zinc-950 text-xs text-zinc-200">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-cyan-200">Reproduce a recorded CSV conversion locally</summary>
    <section aria-label="CSV conversion reproduction tool" className="max-h-[65svh] overflow-y-auto px-4 pb-4">
      <p className="max-w-4xl">Choose the original numeric CSV, exported mapping recipe and exact converted CSV. Reproduce every row with the current adapter, not by trusting a conversion record or imported success receipt. This does not load files into replay, pause/seek, replace sources, import reviews or discard workspace work.</p>
      <p className="mt-2 max-w-4xl text-cyan-100">Exact reproduction does not verify source units, datum, aircraft/OEM compatibility, source truth, identity, authorship/custody, training completion, grades or readiness. Fresh WGS84 confirmation is your statement, not independent verification. Optional complete-file hashes must come through your trusted route; co-delivered hashes do not authenticate themselves.</p>
      <div className="mt-3 grid max-w-5xl gap-3 sm:grid-cols-3">{roles.map(role => <fieldset key={role} disabled={busy} className="min-w-0 rounded border border-zinc-700 p-3">
        <legend className="px-1 font-semibold capitalize">{role}</legend>
        <label className="block">{role === 'recipe' ? 'Mapping recipe JSON,64KiB' : role === 'original' ? 'Original CSV bytes,1MiB' : 'Converted CSV bytes,1MiB'}<input aria-label={'Conversion '+role+' file'} ref={node => { inputs.current[role] = node; }} type="file" accept={role === 'recipe' ? '.json,application/json' : '.csv,text/csv'} className={field} onChange={e => edit(role, 'file', e.target.files?.[0] || null)} /></label>
        <label className="mt-3 block">Optional independent complete-file SHA-256<input aria-label={'Conversion '+role+' expected SHA-256'} value={selection[role].expected} maxLength={64} autoComplete="off" spellCheck={false} className={field+' font-mono'} onChange={e => edit(role, 'expected', e.target.value)} /></label>
      </fieldset>)}</div>
      <label className="mt-3 flex max-w-4xl items-start gap-2"><input aria-label="Fresh original WGS84 confirmation" type="checkbox" checked={ack} disabled={busy} onChange={e => { stale(); setAck(e.target.checked); }} /><span>I freshly confirm this original's latitude/longitude columns are WGS84 decimal degrees. The recipe cannot supply this confirmation. I will inspect source meanings/units myself.</span></label>
      <p className="mt-2 max-w-4xl text-zinc-400">Every file/digest edit resets confirmation and invalidates the prior result, even if reverted. Each check consumes confirmation. All supplied raw-file expectations are checked before parsing or conversion. Exact output includes whitespace/BOM/line endings, not numeric similarity. Generic numeric adapter only, no MAVLink binary, ULog or automatic vendor detection. Configured origin subtraction, unit factors and excluded extra columns remain explicit; no sorting, interpolation, repair or row skipping.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !valid || !ack} onClick={check}>Check exact conversion reproduction</button>
        <button type="button" className="rounded border border-cyan-800 px-3 py-2 disabled:opacity-40" disabled={busy || !result} onClick={download}>Download conversion check receipt</button>
        <button type="button" className="rounded border border-zinc-700 px-3 py-2 disabled:opacity-40" disabled={busy} onClick={clear}>Clear conversion check selections</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 max-w-4xl">{status}</p>
      {result && <div className="mt-2 max-w-4xl break-all font-mono"><p>Exactly reproduced {result.converted_samples} converted samples. This is not a flight or completion count.</p>{roles.map(role => <p key={role}>{role} complete-file SHA-256: {result['exact_'+role+'_sha256']}. {result.expected_raw_digests_matched[role] ? 'Caller expectation matched.' : 'No independent expectation supplied.'}</p>)}</div>}
      <p className="mt-2 max-w-4xl text-zinc-400">Receipt omits filenames, header names, recipe labels, coordinates, individual readings and original absolute timestamps. Hashes/sample counts remain sensitive, not anonymized. Editable unsigned JSON, not a source/recipe backup, reopenable workspace or package-lineage certificate. Download is explicit, never opened or shared automatically. No generated converted CSV is saved, no upload or automatic storage. Clear releases only these selections/result; closing the disclosure only hides them; refresh/tab close drops them. Preserve original CSV, recipe, converted CSV, separate conversion record and excluded work yourself.</p>
    </section>
  </details>;
}
