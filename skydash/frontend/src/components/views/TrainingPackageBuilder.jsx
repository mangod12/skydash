import { useEffect, useRef, useState } from 'react';
import { buildTrainingPackageManifest, checkPackageSelection } from '../../utils/trainingPackageBuilder';
import { downloadBlob } from '../../utils/downloadBlob';
const button = 'rounded border border-cyan-500/30 px-3 py-2 text-cyan-200 disabled:opacity-40';
export default function TrainingPackageBuilder({ workspaceBusy = false, onPause }) {
  const [kind, setKind] = useState('case'), [entries, setEntries] = useState([]), [manifest, setManifest] = useState(null), [checking, setChecking] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
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
  return <details className="rounded-xl border border-emerald-500/25 p-3 text-xs text-zinc-400"><summary className="cursor-pointer text-emerald-200">Prepare a local training package manifest</summary><section aria-label="Local training package builder" className="mt-4 space-y-3 min-w-0">
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
