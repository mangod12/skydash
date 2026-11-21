import { useEffect, useRef } from 'react';
import { recordedObservation } from '../../utils/flightComparison';
export default function InstructorMarkerEvidence({ log, marker, disabled, onPause, onSeek, onClose }) {
  const heading=useRef(null);
  useEffect(()=>{heading.current?.focus();},[marker.id]);
  const evidence=recordedObservation(log.samples,marker.time_s), first=Math.max(0,evidence.index-1);
  const rows=log.samples.slice(first,evidence.index+2);
  const show=value=>value===null?'unknown':String(value);
  return <section aria-label="Instructor marker source context" className="rounded-lg border border-cyan-500/30 p-3 space-y-3 text-xs text-zinc-300">
    <h3 ref={heading} tabIndex={-1} className="font-semibold text-cyan-200">Original source rows around this instructor marker</h3>
    <p className="break-words">ID {marker.id} / {marker.kind} / marker {marker.time_s}s / discussed {String(marker.discussed)}.</p><p className="whitespace-pre-wrap break-words">{marker.text}</p>
    <p>{evidence.ageS===0?'Marker is at an exact recorded timestamp.':`Marker is between observations. Held row is ${evidence.ageS}s before the marker; there is no observation at marker time.`} {evidence.state==='gap'?'DATA GAP over 5s. ':''}All intervals are unsampled, not detected events or causal evidence. Altitude datum is unverified. Unknown readings stay unknown. Rows are recomputed from the current exact source, not the annotation file.</p>
    <ol aria-label="Marker context original rows" className="space-y-2">{rows.map((sample,offset)=>{const index=first+offset;return <li key={index} className="rounded border border-white/10 p-2 space-y-2">
      <p>CSV data row {index+1} / original {sample.time_s}s / {index===evidence.index?(evidence.ageS===0?'exact marker row':'held row before marker'):index<evidence.index?'previous source row':'next source row'}.</p>
      <p>Altitude {show(sample.altitude_m)} m / ground speed {show(sample.ground_speed_m_s)} m/s / battery {show(sample.battery_pct)} %.</p>
      <button type="button" disabled={disabled} onClick={()=>{if(!disabled){onPause();onSeek(sample.time_s);}}} className="rounded border border-cyan-500/25 px-3 py-2 text-cyan-200 disabled:opacity-40">Jump to context row {index+1} at {sample.time_s}s</button>
    </li>;})}</ol>
    <p className="break-all">Source SHA-256 {log.sha256}. Opening and closing this inspector never seeks. Only an explicit row jump pauses/seeks primary replay. No draft, marker, summary, comparison, saved review, source or export changes. No authorship, completion or readiness claim.</p>
    <button type="button" onClick={()=>{onPause();onClose();}} className="rounded border border-cyan-500/25 px-3 py-2 text-cyan-200">Close marker source context</button>
  </section>;
}
