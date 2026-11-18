import { forwardRef, useImperativeHandle, useState } from 'react';
import { Download, ListChecks } from 'lucide-react';
import { ENVELOPE_RULES, ENVELOPE_SCOPE, validateEnvelope, evaluateEnvelope, envelopeProfileJSON, readEnvelopeProfile, envelopeReport } from '../../utils/trainingEnvelope';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed';
const input = 'mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200';
const blank = { name: '', maxAltitude: '', maxSpeed: '', minBattery: '' };
const fromForm = form => validateEnvelope({ name: form.name, ...Object.fromEntries(ENVELOPE_RULES.map(rule => [rule.key, form[rule.key].trim() ? Number(form[rule.key]) : null])) });
const toForm = profile => ({ name: profile.name, ...Object.fromEntries(ENVELOPE_RULES.map(rule => [rule.key, profile[rule.key] === null ? '' : String(profile[rule.key])])) });
const TrainingEnvelope = forwardRef(function TrainingEnvelope({ log, onSeek, onPause, initialReview = null }, ref) {
  const [form, setForm] = useState(() => initialReview ? toForm(initialReview.profile) : blank);
  const [result, setResult] = useState(() => initialReview ? evaluateEnvelope(log, initialReview.profile) : null);
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState(initialReview?.notes || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState({ rule: '', index: 0 });
  useImperativeHandle(ref, () => ({ snapshot() {
    if (busy || pending) throw new Error('Finish or cancel the profile import before exporting a case.');
    if ((result && dirty) || (!result && Object.values(form).some(value => value.trim()))) throw new Error('Review the current envelope criteria before exporting a case. Unevaluated draft criteria cannot be packaged.');
    return result ? { profile: result.profile, notes } : null;
  } }));
  const change = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setMessage(''); };
  const run = event => {
    event.preventDefault(); onPause(); setError(''); setMessage('');
    try { const evaluated = evaluateEnvelope(log, fromForm(form)); setResult(evaluated); setDirty(false); setSelection({ rule: '', index: 0 }); setMessage('Recorded samples reviewed. No aircraft action or grade. All times are elapsed CSV seconds.'); }
    catch (failure) { setDirty(true); setError(failure.message || 'Review could not run.'); }
  };
  const importFile = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy) return;
    onPause(); setBusy(true); setPending(null); setError(''); setMessage('');
    try {
      if (file.size > 8192) throw new Error('Review profile must be at most 8KiB.');
      const profile = readEnvelopeProfile(new globalThis.TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()));
      setPending(profile); setMessage('Profile validated as data, not verified policy. Confirm before replacing fields. It will not run automatically.');
    } catch (failure) { setError(failure.message || 'Could not read profile.'); }
    finally { setBusy(false); }
  };
  const download = kind => {
    if (!result || dirty) return;
    let url;
    try {
      const json = kind === 'profile'; const contents = json ? JSON.stringify(envelopeProfileJSON(result.profile), null, 2) : envelopeReport(log, result.profile, notes);
      url = URL.createObjectURL(new Blob([contents], { type: json ? 'application/json' : 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-envelope-${log.sha256.slice(0, 12)}.${json ? 'json' : 'txt'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError(''); setMessage('Download requested. Keep the profile and exact source CSV to reproduce. Profile contains no source coordinates; report includes source fingerprint, sample times and review notes.');
    } catch { if (url) URL.revokeObjectURL(url); setError('Review download could not start. Current result and notes remain.'); }
  };
  const navigate = (rule, index) => { const chosen = Math.max(0, Math.min(index, rule.matches.length - 1)); setSelection({ rule: rule.key, index: chosen }); onSeek(rule.matches[chosen].time_s); };
  return <article id="training-envelope" aria-label="Training envelope review" className="rounded-xl border border-amber-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-amber-300">TRAINING / RECORDED SAMPLE CRITERIA</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">Training envelope review</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{ENVELOPE_SCOPE}</p></header>
    <p className="text-xs text-zinc-500">Enter your own discussion criteria. There are no default safe limits. Blank channels are disabled; zero is a real threshold. This review does not modify aircraft configuration or the source CSV. Session-only, no server archive needed.</p>
    <form onSubmit={run} noValidate className="space-y-3">
      <label className="block text-xs text-zinc-400">Review profile name<input aria-label="Review profile name" value={form.name} maxLength={120} onChange={event => change('name', event.target.value)} className={input} /></label>
      <div className="grid gap-3 sm:grid-cols-3">{ENVELOPE_RULES.map(rule => <label key={rule.key} className="block text-xs text-zinc-400">{rule.label} ({rule.unit})<input aria-label={`${rule.label} threshold`} type="number" step="any" min={rule.min} max={rule.max} value={form[rule.key]} onChange={event => change(rule.key, event.target.value)} className={input} /><span className="mt-1 block text-[10px] text-zinc-500">Review strictly {rule.direction}; {rule.min} to {rule.max}. Blank disables.</span></label>)}</div>
      <button type="submit" disabled={busy} className={button}><ListChecks size={14} /> Review recorded samples</button>
    </form>
    {error && <p role="alert" className="text-xs text-amber-300">{error} Previous generated result is unchanged.</p>}{message && <p role="status" className="text-xs text-amber-200">{message}</p>}
    {dirty && result && <p role="alert" className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-300">Criteria changed. Results below still use the last generated profile. Run the review again before export or seeking evidence.</p>}
    {result && <div aria-label="Generated envelope review" className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">{result.profile.name} / {result.count} recorded samples</h3>
      <p className="text-xs text-zinc-400">{result.gaps.length} intervals over 5s; no review inside any unsampled interval. Matching samples are individual observations, not continuous events. Equality is not a match.</p>
      {result.rules.map(rule => <section aria-label={`${rule.label} result`} key={rule.key} className="rounded-lg border border-white/10 p-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><h4 className="text-sm text-zinc-200">{rule.label}</h4><span className="text-[10px] text-amber-300">{rule.state === 'disabled' ? 'DISABLED' : rule.state === 'review' ? 'REVIEW MATCHING SAMPLES' : rule.state === 'incomplete' ? 'INCOMPLETE EVIDENCE' : 'NO MATCHING RECORDED SAMPLES'}</span></div>
        {rule.state !== 'disabled' && <><p className="text-xs text-zinc-400">Strictly {rule.direction} {rule.threshold}{rule.unit}. Known {rule.known}/{result.count}, missing {rule.missing}. Matches {rule.matches.length}. No matching recorded samples is not proof of full-flight compliance.</p>
          {rule.matches.length > 0 && <><p className="text-xs text-zinc-300">First {rule.matches[0].time_s}s, last {rule.matches.at(-1).time_s}s. Time between them is not an event duration.</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={dirty} onClick={() => navigate(rule, 0)} className={button}>First {rule.label.toLowerCase()} match</button><button type="button" disabled={dirty} onClick={() => navigate(rule, rule.matches.length - 1)} className={button}>Last {rule.label.toLowerCase()} match</button></div>
            {selection.rule === rule.key && <div className="rounded border border-white/10 p-2 text-xs text-zinc-300">Match {selection.index + 1}/{rule.matches.length}: sample {rule.matches[selection.index].index + 1} at {rule.matches[selection.index].time_s}s, value {rule.matches[selection.index].value}{rule.unit}.<div className="mt-2 flex flex-wrap gap-2"><button disabled={dirty || selection.index === 0} onClick={() => navigate(rule, selection.index - 1)} className={button}>Previous matching sample</button><button disabled={dirty || selection.index === rule.matches.length - 1} onClick={() => navigate(rule, selection.index + 1)} className={button}>Next matching sample</button></div></div>}
          </>}
        </>}
      </section>)}
      <label className="block text-xs text-zinc-400">Envelope review notes<textarea aria-label="Envelope review notes" rows={3} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} className={input} /></label>
      <p className="text-[10px] text-zinc-500 break-all">Source SHA-256 {log.sha256}. Export includes every matching sample, profile and evidence counts. Changes to notes require a new download; no automatic save. Profile thresholds are not verified institutional policy.</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={dirty || busy} onClick={() => download('report')} className={button}><Download size={14} /> Download envelope report</button><button type="button" disabled={dirty || busy} onClick={() => download('profile')} className={button}><Download size={14} /> Download review profile</button></div>
    </div>}
    <div className="border-t border-white/10 pt-3 space-y-2"><h3 className="text-sm font-semibold text-zinc-200">Reuse a review profile</h3><p className="text-xs text-zinc-500">Import a profile JSON (up to 8KiB), confirm fields, then run on this source. A profile is not source-bound and contains no notes, samples or decisions. New fields invalidate the previous result; your review notes remain. Download profile JSON separately to reuse criteria.</p><input aria-label="Import review profile" type="file" accept=".json,application/json" disabled={busy} onChange={importFile} className="block w-full min-w-0 text-xs text-zinc-400" /></div>
    {pending && <div className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-300"><p>Replace criteria with profile {pending.name}? It is unverified, user-authored data.</p><ul>{ENVELOPE_RULES.map(rule => <li key={rule.key}>{rule.label}: {pending[rule.key] === null ? 'disabled' : `${rule.direction} ${pending[rule.key]}${rule.unit}`}</li>)}</ul><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => { setForm(toForm(pending)); setPending(null); setDirty(true); setMessage('Imported profile fields applied. Review notes kept. Run explicitly to generate a new result.'); }} className={button}>Use imported criteria</button><button type="button" onClick={() => { setPending(null); setMessage('Profile import cancelled. Current fields and results kept.'); }} className={button}>Keep current criteria</button></div></div>}
  </article>;
});
export default TrainingEnvelope;
