import { useEffect, useRef, useState } from 'react';
import { createPairedReviewBundle, readPairedReviewBundle, MAX_PAIRED_BUNDLE_BYTES, PAIRED_BUNDLE_SCOPE } from '../../utils/pairedReviewBundle';
const button = 'rounded border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 disabled:opacity-40';
export default function PairedReviewBundle({ hasSource, workspaceBusy, getSnapshot, onOpen, onPause }) {
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const heading = useRef(null);
  useEffect(() => { if (pending) { heading.current?.focus(); heading.current?.scrollIntoView?.({ block: 'center' }); } }, [pending]);
  const disabled = busy || workspaceBusy;
  const download = async () => {
    if (disabled || pending) return;
    onPause(); setBusy(true); setError(''); setMessage(''); let url;
    try {
      const snapshot = getSnapshot(), contents = await createPairedReviewBundle(snapshot.primary, snapshot.comparison);
      url = URL.createObjectURL(new Blob([contents], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-paired-review-${snapshot.primary.log.sha256.slice(0, 8)}-${snapshot.comparison.baseline.sha256.slice(0, 8)}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Paired bundle download requested. Both exact full CSVs and listed review sections included, not a complete workspace backup. Re-export after edits. No upload or server record.');
    } catch (failure) { if (url) URL.revokeObjectURL(url); setError(failure.message || 'Paired bundle download could not start.'); }
    finally { setBusy(false); }
  };
  const read = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || disabled) return;
    onPause(); setBusy(true); setPending(null); setError(''); setMessage('');
    try {
      if (file.size > MAX_PAIRED_BUNDLE_BYTES) throw new Error('Paired review bundle must be at most 4MiB.');
      const text = new globalThis.TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      setPending(await readPairedReviewBundle(text)); setMessage('Both sources, fingerprints and review models checked. Preview only, not verified authorship. Nothing replaced.');
    } catch (failure) { setError(failure.message || 'Paired bundle could not be read.'); }
    finally { setBusy(false); }
  };
  return <article aria-label="Paired review source bundle" className="rounded-xl border border-violet-500/25 p-4 space-y-3">
    <h2 className="text-lg text-violet-200">Two-source review handoff</h2><p className="text-xs leading-relaxed text-zinc-400">{PAIRED_BUNDLE_SCOPE}</p>
    <p className="text-xs text-zinc-500">Download needs both sources, applied or discarded anchor edits, no pending comparison import/replacement, and a primary case snapshot with no unfinished marker/envelope work. Both replay clocks pause when collecting a snapshot. Downloads are sensitive files, not secure transport or a server save.</p>
    <button className={button} disabled={disabled || !hasSource || Boolean(pending)} onClick={download}>Download paired review bundle JSON</button>
    <label className="block text-xs text-zinc-400">Open paired review bundle JSON (up to 4MiB)<input aria-label="Open paired review bundle JSON" type="file" accept=".json,application/json" disabled={disabled} onChange={read} className="mt-2 block w-full min-w-0 text-xs" /></label>
    {busy && <p role="status" className="text-xs text-violet-200">Checking paired review data locally...</p>}{error && <p role="alert" className="text-xs text-amber-300">{error} Current workspace not replaced.</p>}{message && <p role="status" className="text-xs text-violet-200">{message}</p>}
    {pending && <section aria-label="Paired review bundle preview" className="rounded border border-amber-500/30 p-3 space-y-3 text-xs text-zinc-400">
      <h3 ref={heading} tabIndex={-1} className="text-sm text-amber-200">Checked two-source bundle. Current workspace kept.</h3>
      {[[pending.primary.log, 'A / primary'], [pending.comparison.baseline, 'B / baseline']].map(([log, label]) => <p key={label} className="[overflow-wrap:anywhere]">{label}: {log.filename} (unverified). {log.samples.length} original samples, 0s through {log.samples.at(-1).time_s}s, not continuous observed duration. Exact SHA-256 {log.sha256}.</p>)}
      <p>{pending.primary.data.debrief.markers.length} added instructor markers. {pending.primary.data.envelope ? 'Evaluated envelope criteria included.' : 'No envelope criteria.'} Comparison notes: {pending.comparison.notes.length} characters. {pending.comparison.alignment ? 'Manual applied anchors included, not verified simultaneous events.' : 'CSV-start alignment.'}</p>
      <p>Confirm replaces both sources and primary analyst/instructor/envelope review, comparison notes and applied anchors. Both clocks reset to zero; all other panels, notebook/recovery and unfinished drafts are cleared, even for identical source fingerprints. No row or annotation matching. Download other current work separately before opening. Existing server/device-local records and downloaded files are not changed. No upload or aircraft command.</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={disabled} onClick={() => { if (disabled || !pending) return; onPause(); onOpen(pending); setPending(null); }}>Replace workspace with checked paired review</button><button className={button} disabled={disabled} onClick={() => { setPending(null); setMessage('Paired bundle opening canceled. Current workspace kept.'); }}>Keep current workspace and sources</button></div>
    </section>}
  </article>;
}
