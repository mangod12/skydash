import { useEffect, useRef } from 'react';
const button = 'rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 disabled:opacity-40';
export default function RecordedExitPreview({ pending, disabled, onKeep, onLeave }) {
  const heading = useRef(null);
  useEffect(() => { if (pending) { heading.current?.focus(); heading.current?.scrollIntoView?.({ block: 'center' }); } }, [pending]);
  if (!pending) return null;
  return <section aria-label="Leave recorded workspace preview" className="rounded-xl border border-amber-500/30 p-4 space-y-3 text-xs text-zinc-400">
    <h2 ref={heading} tabIndex={-1} className="text-sm text-amber-200">Keep or leave this recorded workspace?</h2>
    <p className="[overflow-wrap:anywhere]">Requested destination: {pending.kind === 'back' ? 'Scenario Lab' : pending.kind === 'workspace' ? `${pending.value} workspace` : `${pending.value} view`}. Navigation has not happened.</p>
    <p>Leaving discards this session's primary CSV, analyst edits, instructor notes, criteria, window drafts/results, saved notebook and recovery point, comparison and pending imports. Downloads and existing server/device-local records are not deleted or updated. They may not contain your latest work.</p>
    <p>This is a conservative source-open warning, not a check that everything is saved. Keep the workspace to finish or download the artifacts you need. No single export includes every panel or draft. Primary playback is paused; comparison stays independent. Nothing is stored or uploaded by this warning.</p>
    <p>Refresh, tab close or external navigation may show a browser-controlled warning when supported after interaction. It is not guaranteed on every browser or mobile device. Authentication expiry, sign-out, crashes and forced app closure can still discard work. No autosave or complete recovery is provided.</p>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={disabled} onClick={onKeep}>Keep recorded workspace open</button><button className={button} disabled={disabled} onClick={onLeave}>Leave and discard recorded session</button></div>
  </section>;
}
