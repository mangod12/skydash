import { useEffect, useRef } from 'react';
const button = 'rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 disabled:opacity-40 max-w-full [overflow-wrap:anywhere]';
export default function BaselineReplacementPreview({ current, candidate, disabled, onConfirm, onCancel }) {
  const heading = useRef(null);
  useEffect(() => { if (candidate) { heading.current?.focus(); heading.current?.scrollIntoView?.({ block: 'center' }); } }, [candidate]);
  if (!current || !candidate) return null;
  return <section aria-label="Recorded baseline replacement preview" className="rounded-xl border border-amber-500/30 p-4 space-y-3 text-xs text-zinc-400">
    <h3 ref={heading} tabIndex={-1} className="text-sm text-amber-200">Baseline checked locally. Current comparison not replaced.</h3>
    <p className="[overflow-wrap:anywhere]">Current B: {current.filename}. Exact UTF-8 SHA-256 {current.sha256}.</p>
    <p className="[overflow-wrap:anywhere]">Proposed B: {candidate.filename} (unverified filename). Exact UTF-8 SHA-256 {candidate.sha256}.</p>
    <p>{candidate.samples.length} original samples, original 0s through {candidate.samples.at(-1).time_s}s. Timestamp span is not continuous observed duration. Parser: {candidate.model_version}. Source identity/authenticity is unverified.</p>
    <p>{candidate.sha256 === current.sha256 ? 'The exact baseline fingerprint is identical. Confirmation still clears comparison notes and review state.' : 'The exact baseline fingerprint differs. No rows, notes or anchors are transferred.'}</p>
    <p>Confirm replaces baseline B using these checked bytes, clears comparison notes, applied anchors and unfinished anchor edits, independent-window drafts/results, channel plots, row/rank filters and pending comparison imports. Comparison resets to zero and external basemap permission resets off, even for an identical CSV. Cancel first to finish or download current work. Primary A, its clock and all primary reviews remain unchanged. Existing downloads and server/device-local records are not deleted or updated.</p>
    <p>Preview only, not a download, storage or upload. Comparison playback paused while checking; primary replay is independent. Current comparison remains available until confirmation. Another baseline check replaces this proposal; importing a comparison review or clearing the comparison discards it. Session-only, no aircraft commands.</p>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={disabled} onClick={onConfirm}>Replace baseline with checked source</button><button className={button} disabled={disabled} onClick={onCancel}>Keep current baseline and comparison</button></div>
  </section>;
}
