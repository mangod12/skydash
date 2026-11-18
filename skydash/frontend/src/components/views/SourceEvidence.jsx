import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { QUALITY_SCOPE, sourceEvidence, sourceEvidenceReport } from '../../utils/sourceEvidence';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-200 disabled:opacity-40 disabled:cursor-not-allowed';
const PAGE_SIZE = 12;
export default function SourceEvidence({ log, onSeek }) {
  const data = useMemo(() => sourceEvidence(log), [log]);
  const [category, setCategory] = useState('gaps');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const groups = [
    { key: 'gaps', label: 'Intervals over 5s', items: data.gaps, kind: 'gap' },
    ...data.channels.map(channel => ({ key: channel.key, label: `${channel.label} missing rows`, items: channel.runs, kind: 'missing' })),
    { key: 'repeated', label: 'Repeated coordinates', items: data.repeated, kind: 'repeated' },
  ];
  const selected = groups.find(group => group.key === category);
  const pages = Math.max(1, Math.ceil(selected.items.length / PAGE_SIZE));
  const items = selected.items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const download = () => {
    let url;
    try {
      url = URL.createObjectURL(new Blob([sourceEvidenceReport(log)], { type: 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-source-evidence-${log.sha256.slice(0, 12)}.txt`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError(''); setMessage('Download requested. Includes all inventory groups, source fingerprint and timestamps, not only this page. No coordinates or private notes included.');
    } catch { if (url) URL.revokeObjectURL(url); setError('Evidence report download could not start. Source remains unchanged.'); }
  };
  return <article id="source-evidence" aria-label="Source evidence inventory" className="rounded-xl border border-sky-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-sky-300">TRAINING / KNOW YOUR SOURCE</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">Source evidence inventory</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{QUALITY_SCOPE}</p></header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Rows', data.count], ['Min interval', `${data.min_interval_s}s`], ['Median interval', `${data.median_interval_s}s`], ['Max interval', `${data.max_interval_s}s`]].map(([label, value]) => <div key={label}><p className="text-[10px] text-zinc-500">{label}</p><p className="text-lg text-sky-200">{value}</p></div>)}</div>
    <p className="text-xs text-zinc-500">{data.interval_count} adjacent timestamp intervals, not a logging-rate estimate. Median is the middle spacing, or the mean of the two middle spacings. There is no verified expected sample rate. No lost-sample or completeness percentage is calculated.</p>
    <div className="flex flex-wrap gap-2">{data.buckets.map(bucket => <span key={bucket.label} className="rounded border border-white/10 p-2 text-xs text-zinc-300">{bucket.label}: {bucket.count}</span>)}</div>
    <div className="space-y-2" aria-label="Source channel evidence">{data.channels.map(channel => <p key={channel.key} className="text-xs text-zinc-400">{channel.label}: known {channel.known}/{data.count}, missing {channel.missing}, consecutive missing-row groups {channel.runs.length}.</p>)}</div>
    <label className="block text-xs text-zinc-400">Evidence group<select aria-label="Evidence group" value={category} onChange={event => { setCategory(event.target.value); setPage(0); }} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200">{groups.map(group => <option key={group.key} value={group.key}>{group.label} ({group.items.length})</option>)}</select></label>
    <p className="text-xs text-zinc-500">Group boundaries identify CSV rows, not continuous event boundaries. Jump buttons pause replay at an exact recorded endpoint. Missing-row timestamps do not measure outage length; identical coordinates do not prove a frozen sensor or stationary flight.</p>
    <ol aria-label="Source evidence groups" className="space-y-2">{items.map((item, index) => <li key={`${category}-${item.from_index}`} className="rounded-lg border border-white/10 p-3 space-y-2">
      <p className="text-xs text-zinc-200">{page * PAGE_SIZE + index + 1}. Rows {item.from_index + 1} to {item.to_index + 1}: {item.from_s}s to {item.to_s}s.</p>
      <p className="text-xs text-zinc-400">{selected.kind === 'gap' ? `${item.interval_s}s between observations. No observation inside this interval.` : selected.kind === 'missing' ? `${item.count} consecutive missing cells. Timestamp span is not outage duration.` : `${item.count} consecutive identical coordinate rows. No motion or fault conclusion.`}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => onSeek(item.from_s)}>Jump to row {item.from_index + 1} at {item.from_s}s</button>{item.to_index !== item.from_index && <button type="button" className={button} onClick={() => onSeek(item.to_s)}>Jump to row {item.to_index + 1} at {item.to_s}s</button>}</div>
    </li>)}</ol>
    {!items.length && <p className="text-xs text-sky-200">No groups in this category. This is not proof of full-flight completeness or source authenticity.</p>}
    <div className="flex flex-wrap items-center gap-2"><button className={button} disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous evidence page</button><span className="text-xs text-zinc-400">Page {page + 1}/{pages}, {selected.items.length} groups, up to {PAGE_SIZE} per page</span><button className={button} disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Next evidence page</button></div>
    <p className="break-all text-[10px] text-zinc-500">Source SHA-256 {log.sha256}. This inventory is derived from the current CSV, not stored annotations. The combined portable case report includes the same full inventory. Source rows are never repaired or changed.</p>
    <button type="button" className={button} onClick={download}><Download size={14} /> Download source evidence report</button>{error && <p role="alert" className="text-xs text-amber-300">{error}</p>}{message && <p role="status" className="text-xs text-sky-200">{message}</p>}
  </article>;
}
