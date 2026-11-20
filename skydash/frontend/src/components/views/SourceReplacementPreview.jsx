import { useEffect, useRef } from 'react';
const button = 'rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 disabled:opacity-40 max-w-full [overflow-wrap:anywhere]';
export default function SourceReplacementPreview({ current, candidate, disabled, onConfirm, onCancel }) {
  const heading = useRef(null);
  useEffect(() => { if (candidate) { heading.current?.focus(); heading.current?.scrollIntoView?.({ block: 'center' }); } }, [candidate]);
  if (!candidate || !current) return null;
  return <section aria-label="Recorded source replacement preview" className="rounded-xl border border-amber-500/30 p-4 space-y-3 text-xs text-zinc-400">
    <h2 ref={heading} tabIndex={-1} className="text-sm text-amber-200">Source checked locally. Current workspace not replaced.</h2>
    <p className="[overflow-wrap:anywhere]">Current source: {current.filename}. Exact UTF-8 SHA-256 {current.sha256}.</p>
    <p className="[overflow-wrap:anywhere]">Proposed source: {candidate.filename} (unverified filename). Exact UTF-8 SHA-256 {candidate.sha256}.</p>
    <p>{candidate.samples.length} original samples, original 0s through {candidate.samples.at(-1).time_s}s. This timestamp span is not continuous observed duration. Parser: {candidate.model_version}. Source identity/authenticity is not verified.</p>
    <p>{candidate.sha256 === current.sha256 ? 'The exact source fingerprint is identical. Confirmation still clears the current reviews and comparison.' : 'This is a different exact source fingerprint. No rows or annotations are matched or transferred.'}</p>
    <p>Confirming replaces the primary CSV and title/analyst notes with this source, resets primary replay to zero, and clears instructor markers, criteria, window draft/result, saved notebook and its recovery point, circle/actions/checklist/follow-up, comparison and pending review imports. Unsaved work will be lost, even for an identical CSV. Cancel first to finish or download current work. Existing server records, downloaded files and device-local snapshots are not deleted or updated.</p>
    <p>This preview is session-only, not an export, upload or storage action. Primary replay paused while checking; comparison remains independent. No aircraft commands. Choosing another source replaces this proposal; completing another source-opening workflow discards it.</p>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={disabled} onClick={onConfirm}>Replace recorded workspace with checked source</button><button className={button} disabled={disabled} onClick={onCancel}>Keep current recorded workspace</button></div>
  </section>;
}
