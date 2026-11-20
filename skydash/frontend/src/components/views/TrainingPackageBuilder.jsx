import { checkReceivedTrainingPackage } from '../../utils/receivedTrainingPackage';
import { useEffect, useRef, useState } from 'react';
import { buildTrainingPackageManifest, checkPackageSelection } from '../../utils/trainingPackageBuilder';
import { downloadBlob } from '../../utils/downloadBlob';
const button = 'rounded border border-cyan-500/30 px-3 py-2 text-cyan-200 disabled:opacity-40';
export default function TrainingPackageBuilder({ workspaceBusy = false, onPause }) {
  const [kind, setKind] = useState('case'), [entries, setEntries] = useState([]), [manifest, setManifest] = useState(null), [checking, setChecking] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [receivedManifest, setReceivedManifest] = useState(null), [receivedFiles, setReceivedFiles] = useState([]), [expected, setExpected] = useState(''), [received, setReceived] = useState(null);
  const staleReceived = () => { setReceived(null); setError(''); setMessage(''); };
  const checkReceived = async () => {
    if (locked || !receivedManifest) return; onPause?.(); staleReceived(); setChecking(true);
    try { const result = await checkReceivedTrainingPackage(receivedManifest, receivedFiles, expected); if (active.current) setReceived(result); }
    catch { if (active.current) setError('Received package refused. Check plain exact filenames, all and only listed originals, hashes, kinds, UTF-8 and nested review limits. No partial success.'); }
    finally { if (active.current) setChecking(false); }
  };
  const active = useRef(true), locked = checking || workspaceBusy;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const reset = () => { setManifest(null); setError(''); setMessage(''); };
  const add = event => {
    const files = [...(event.target.files || [])]; event.target.value = ''; if (locked || !files.length) return;
    reset(); try { const next = [...entries, ...files.map(file => ({ kind, file }))]; checkPackageSelection(next); setEntries(next); } catch { setError('Selection refused. Check unique filenames, kinds, counts and size limits. Existing files kept; validate again.'); }
  };
  const validate = async () => {
    if (locked || !entries.length) return; onPause?.(); reset(); setChecking(true);
    try { const result = await buildTrainingPackageManifest(entries); if (active.current) setManifest(result); }
    catch { if (active.current) setError('No manifest prepared. Check kinds, UTF-8, nested source/review validation and file limits. No private content echoed.'); }
    finally { if (active.current) setChecking(false); }
  };
  const download = () => {
    if (locked || !manifest) return; setError('');
    try { let name = 'skydash-training-manifest.json', n = 0; while (entries.some(entry => entry.file.name.toLowerCase() === name.toLowerCase())) name = `skydash-training-manifest-${++n}.json`; downloadBlob(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), name); setMessage('Manifest download requested, not proof it was saved. Originals are not copied. Keep them unchanged beside the manifest with exact listed filenames. Nothing shared.'); }
    catch { setError('Manifest download failed. Checked selection kept for retry.'); }
  };
  return <details className="rounded-xl border border-emerald-500/25 p-3 text-xs text-zinc-400"><summary className="cursor-pointer text-emerald-200">Prepare or check a local training package</summary><section aria-label="Local training package builder" className="mt-4 space-y-3 min-w-0">
    <details className="rounded border border-white/10 p-3"><summary className="cursor-pointer text-cyan-200">Check a received manifest and original files locally</summary><div className="mt-3 space-y-3">
      <p>No source opening or workspace replacement. Checks exact selected bytes and current nested reviews. Plain filenames only here, no subfolders or ZIP extraction; use the offline CLI for folder paths. Session-only, no storage/upload/sharing.</p>
      <label className="block">Received manifest JSON, up to64KiB<input aria-label="Received training manifest" type="file" accept=".json,application/json" disabled={locked} className="block w-full" onChange={e => { staleReceived(); setReceivedManifest(e.target.files?.[0] ?? null); e.target.value = ''; }} /></label>
      <p className="break-all">Manifest: {receivedManifest?.name || 'none'}</p>
      <label className="block">Select all original JSON artifacts<input aria-label="Received training originals" type="file" accept=".json,application/json" multiple disabled={locked} className="block w-full" onChange={e => { staleReceived(); setReceivedFiles([...(e.target.files || [])]); e.target.value = ''; }} /></label>
      <ol aria-label="Received selected filenames">{receivedFiles.map((file, i) => <li className="break-all" key={i}>{i + 1}. {file.name} ({file.size} bytes)</li>)}</ol>
      <p>{receivedFiles.length} selected originals.1to20,2MiB case/notebook,4MiB paired,20MiB total. No extra files or duplicate names.</p>
      <label className="block">Optional independent complete-manifest SHA-256<input aria-label="Expected received manifest SHA-256" disabled={locked} value={expected} onChange={e => { staleReceived(); setExpected(e.target.value); }} className="mt-1 w-full rounded bg-zinc-900 p-2 font-mono" /></label>
      <p>Obtain expectations independently. A manifest with its own hashes is editable, not authenticity, custody, identity, completion, grades or readiness. Filenames/hashes are sensitive. Keep originals unchanged and preserve excluded work separately.</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={locked || !receivedManifest || !receivedFiles.length} onClick={checkReceived}>Check received package</button><button className={button} disabled={locked} onClick={() => { staleReceived(); setReceivedManifest(null); setReceivedFiles([]); setExpected(''); }}>Clear received selection</button></div>
      {received && <div role="status" className="space-y-2"><p>All {received.bundles.length} received originals passed exact manifest artifact hashes and nested validation. No partial success, source opening or server save.</p><p className="break-all font-mono">Complete manifest SHA-256 {received.exact_manifest_sha256}</p><p>{received.expected_manifest_digest_matched ? 'Supplied expected manifest digest matched.' : 'No independent manifest expectation supplied.'}</p><ol>{received.bundles.map((entry, i) => <li className="break-all" key={entry.path}>{i + 1}. {entry.kind}: {entry.path}, SHA-256 {entry.sha256}</li>)}</ol><p>This local display is not a saved/reopenable receipt, source backup or complete handoff certificate. Any selection or expectation edit requires checking again.</p></div>}
    </div></details>
    <h2 className="text-lg text-emerald-100">Prepare files for instructor handoff</h2>
    <p>Select existing exported artifacts, not unsaved workspace fields. Choose their kind before adding files. Validation pauses primary replay only. Sources, notes, notebook and comparison stay unchanged. Session-only, not stored.</p>
    <p className="text-amber-200">Generated hashes describe selected bytes, not independent expectations, authenticity, custody, grades or readiness. Confirm the audience before sharing.</p>
    <div className="flex flex-wrap gap-3"><label>Kind to add<select aria-label="Training package artifact kind" value={kind} disabled={locked} onChange={event => setKind(event.target.value)} className="ml-2 rounded bg-zinc-900 p-2"><option value="case">Single-source case</option><option value="notebook">Notebook source bundle</option><option value="paired">Paired review bundle</option></select></label><label className="block min-w-0">Add exported JSON files<input aria-label="Add training package artifacts" type="file" accept=".json,application/json" multiple disabled={locked} onChange={add} className="mt-2 block w-full min-w-0" /></label></div>
    <p>1 to 20 unique plain filenames, 2MiB case/notebook, 4MiB paired, 20MiB combined. No directories or duplicate names. Wrong kind refuses the whole check.</p>
    {entries.length > 0 && <ol aria-label="Selected training artifacts" className="space-y-2">{entries.map(({ kind: type, file }, index) => <li key={file.name} className="rounded border border-white/10 p-3 min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all">{index + 1}. {type}: {file.name} ({file.size} bytes)</span><button disabled={locked} className={button} aria-label={`Remove training artifact ${index + 1}`} onClick={() => { reset(); setEntries(entries.filter((_, ordinal) => ordinal !== index)); }}>Remove</button></div>{manifest && <p className="mt-2 break-all font-mono">SHA-256 {manifest.bundles[index].sha256}</p>}</li>)}</ol>}
    <div className="flex flex-wrap gap-2"><button className={button} disabled={locked || !entries.length} onClick={validate}>Validate selected artifacts</button><button className={button} disabled={locked || !manifest} onClick={download}>Download checked manifest JSON</button><button className={button} disabled={locked || !entries.length} onClick={() => { reset(); setEntries([]); }}>Clear package selection</button></div>
    {checking && <p role="status">Checking every original artifact locally. No partial manifest is downloadable.</p>}
    {manifest && <p role="status">All {manifest.bundles.length} selected artifacts passed nested validation. Review the ordered filenames and hashes above. Manifest v2 contains filenames, kinds and full-file hashes only, not source backups. Any selection edit requires validation again.</p>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="rounded border border-white/10 p-3 space-y-2"><h3 className="text-zinc-200">Finish outside the browser</h3><p>Keep all listed originals unchanged beside the manifest. From skydash/frontend in a checkout with dependencies installed, run:</p><code className="block break-all text-cyan-200">node scripts/verify-training-manifest.mjs MANIFEST.json</code><code className="block break-all text-cyan-200">node scripts/report-training-intake.mjs MANIFEST.json &gt; intake-report.html</code><p>Replace MANIFEST.json with your path and check exit status. HTML is editable, not a reopenable package or handoff certificate. Keep mapping originals/recipes/converted files and excluded work separately. Lineage requires its own manifest and fresh coordinate confirmation. No lineage check, upload, sharing, server save or aircraft commands here. Original artifacts contain private notes/coordinates; filenames and hashes are sensitive too.</p></div>
  </section></details>;
}
