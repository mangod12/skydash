import { useState } from 'react';
import { Download, PackageOpen } from 'lucide-react';
import { CASE_SCOPE, MAX_CASE_BYTES, createReviewCase, readReviewCase, reviewCaseReport } from '../../utils/reviewCase';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed';
export default function ReviewCase({ log, workspaceBusy = false, getSnapshot, onOpen, onPause }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const download = async kind => {
    if (busy || !log) return;
    onPause(); setBusy(true); setError(''); setMessage(''); let url;
    try {
      const snapshot = getSnapshot();
      const contents = await createReviewCase(snapshot.log, snapshot.review, snapshot.debrief, snapshot.envelope);
      const report = kind === 'report';
      const output = report ? reviewCaseReport(await readReviewCase(contents)) : contents;
      url = URL.createObjectURL(new Blob([output], { type: report ? 'text/plain;charset=utf-8' : 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-review-case-${snapshot.log.sha256.slice(0, 12)}.${report ? 'txt' : 'json'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Download requested. Snapshot includes the exact primary CSV and current added review state. It contains coordinates and private notes. Re-export after edits; comparison is excluded.');
    } catch (failure) { if (url) URL.revokeObjectURL(url); setError(failure.message || 'Case download could not start. Current review remains.'); }
    finally { setBusy(false); }
  };
  const read = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy || workspaceBusy) return;
    onPause(); setBusy(true); setPending(null); setError(''); setMessage('');
    try {
      if (file.size > MAX_CASE_BYTES) throw new Error('Review case JSON must be at most 2MiB.');
      const contents = new globalThis.TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      const opened = await readReviewCase(contents);
      setPending(opened); setMessage('Case data validated locally. Source fingerprint, models and review bounds checked, not authorship. Nothing replaced. Confirm to open.');
    } catch (failure) { setError(failure.message || 'Case could not be read. Current source and review remain.'); }
    finally { setBusy(false); }
  };
  const apply = () => { onPause(); onOpen(pending); setPending(null); setMessage('Review case opened locally at time zero. Reports and envelope results recomputed from its CSV; source and review identity remain unverified. No backend records changed.'); };
  return <article id="portable-review-case" aria-label="Portable review case" className="rounded-xl border border-violet-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-violet-300">TRAINING / SINGLE-FILE HANDOFF</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">Portable review case</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{CASE_SCOPE}</p></header>
    <p className="text-xs text-zinc-400">Keep the primary CSV, analyst title/notes, added instructor markers/discussion summary and evaluated envelope profile/notes together. Reopen this JSON in SkyDash without a server archive. Its review data is editable and unverified, not a certificate. Combined text report is for reading, JSON is for reopening.</p>
    <p className="text-xs text-zinc-500">Excluded: comparison baseline and notes, replay cursor and unadded/unevaluated drafts. Export blocks on an unadded marker, pending review import or unevaluated criteria so they are not silently lost. Download any comparison separately. No automatic save. All data remains session-only until downloaded.</p>
    <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || !log || Boolean(pending)} onClick={() => download('case')}><Download size={14} /> Download review case JSON</button><button type="button" className={button} disabled={busy || !log || Boolean(pending)} onClick={() => download('report')}><Download size={14} /> Download combined case report</button></div>
    <label className="block text-xs text-zinc-400"><PackageOpen size={14} className="inline mr-2" />Open review case JSON (up to 2MiB)<input aria-label="Open review case JSON" type="file" accept=".json,application/json" disabled={busy || workspaceBusy} onChange={read} className="mt-2 block w-full min-w-0 text-xs text-zinc-400" /></label>
    {busy && <p role="status" className="text-xs text-violet-200">Checking local case data...</p>}{error && <p role="alert" className="text-xs text-amber-300">{error} Current local source and review have not been replaced.</p>}{message && <p role="status" className="text-xs text-violet-200">{message}</p>}
    {pending && <div className="rounded-lg border border-amber-500/30 p-3 space-y-2 text-xs text-amber-300"><h3 className="font-semibold break-words">Open case: {pending.log.title}</h3><p className="break-all">Source {pending.log.filename}, SHA-256 {pending.log.sha256}.</p><p>{pending.log.samples.length} samples / {pending.log.samples.at(-1).time_s}s. {pending.data.debrief.markers.length} instructor markers. {pending.data.envelope ? `Envelope criteria: ${pending.data.envelope.profile.name}` : 'No envelope criteria.'}</p><p>This replaces the current primary source, analyst notes, instructor timeline and envelope review, including unsaved drafts. It also clears the current comparison. Download current work separately before opening. Imported notes and policy names are unverified. No server record is created.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={workspaceBusy} onClick={apply} className={button}>Replace local workspace with case</button><button type="button" onClick={() => { setPending(null); setMessage('Case opening cancelled. Current workspace kept.'); }} className={button}>Keep current workspace</button></div></div>}
  </article>;
}
