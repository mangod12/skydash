import { useMemo, useState } from 'react';
import { sampleIndexAt } from '../../utils/flightLog';
import { CHART_CHANNELS, CHART_SCOPE, channelChart, nearestChartSample, channelChartReport } from '../../utils/channelChart';
const button = 'rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40';
export default function RecordedChannelChart({ log, time, onPause, onSeek }) {
  const [channel, setChannel] = useState('altitude_m'), [error, setError] = useState(''), [message, setMessage] = useState('');
  const chart = useMemo(() => channelChart({ samples: log.samples, model_version: log.model_version }, channel), [log.samples, log.model_version, channel]);
  const metadata = CHART_CHANNELS.find(item => item.key === channel), index = sampleIndexAt(log.samples, time), sample = log.samples[index], next = log.samples[index + 1];
  const gap = Boolean(next && next.time_s - sample.time_s > 5 && time > sample.time_s), value = sample[channel];
  const seek = row => { onPause(); onSeek(log.samples[row].time_s); setMessage(`Selected exact source data row ${row + 1} at ${log.samples[row].time_s}s. No event or value inferred between rows.`); };
  const click = event => { const rect = event.currentTarget.getBoundingClientRect(); if (!rect.width) return; const x = (event.clientX - rect.left) / rect.width * 800; seek(nearestChartSample(log.samples, Math.min(chart.duration, Math.max(0, (x - 55) / 730 * chart.duration)))); };
  const download = () => {
    let url; setError('');
    try { url = URL.createObjectURL(new Blob([channelChartReport(log, channel)], { type: 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-channel-${channel}-${log.sha256.slice(0, 12)}.txt`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Channel evidence download requested. All source rows included; no coordinates or private notes, but source identity and times may be sensitive.'); }
    catch { if (url) URL.revokeObjectURL(url); setError('Channel evidence download could not start. Source unchanged.'); }
  };
  const axis = number => Number(number.toPrecision(6)).toString();
  return <article id="recorded-channel-chart" aria-label="Recorded channel evidence plot" className="rounded-xl border border-cyan-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-cyan-300">TRAINING / INSPECT RECORDED CHANNELS</p><h2 className="mt-1 text-lg text-zinc-100">Recorded channel evidence plot</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{CHART_SCOPE}</p></header>
    <label className="block text-xs text-zinc-400">Plot channel<select aria-label="Plot channel" value={channel} onChange={event => { onPause(); setChannel(event.target.value); setMessage(''); setError(''); }} className="ml-2 rounded bg-zinc-900 p-2">{CHART_CHANNELS.map(item => <option key={item.key} value={item.key}>{item.label} ({item.unit})</option>)}</select></label>
    <p className="text-xs text-zinc-400">{metadata.caveat} Known {chart.count}/{log.samples.length}, missing {chart.missing}. Observed min {chart.min ?? 'unknown'}, max {chart.max ?? 'unknown'} {metadata.unit}. Automatic Y axis, not safe limits; compare values, not apparent slope across different channels/scales.</p>
    <p className="text-[10px] text-zinc-500">Plot uses original source seconds. On narrow screens, scroll horizontally inside the plot to see the full source range.</p>
    <div className="overflow-x-auto rounded border border-white/10 bg-zinc-950"><svg aria-label={`${metadata.label} by original source time`} role="img" viewBox="0 0 800 270" preserveAspectRatio="none" className="block h-64 w-full min-w-[640px] cursor-crosshair" onClick={click}>
      <title>{metadata.label} recorded sample plot</title><desc>All known values, original elapsed source timestamps. Unknown rows and intervals over five seconds break connecting guides. Use previous and next sample buttons for keyboard-accessible exact navigation. Clicking selects the nearest source row including unknown values.</desc>
      {[0,0.5,1].map(ratio => <g key={ratio}><line x1="55" x2="785" y1={35+190*ratio} y2={35+190*ratio} stroke="#27272a" /><text x="50" y={39+190*ratio} textAnchor="end" fontSize="10" fill="#a1a1aa">{axis(chart.high-(chart.high-chart.low)*ratio)}</text></g>)}
      <text x="55" y="20" fontSize="11" fill="#a1a1aa">{metadata.unit}, axis rounded</text><line x1="55" x2="55" y1="35" y2="225" stroke="#52525b" /><line x1="55" x2="785" y1="225" y2="225" stroke="#52525b" /><text x="55" y="248" fontSize="11" fill="#a1a1aa">0s</text><text x="420" y="248" textAnchor="middle" fontSize="11" fill="#a1a1aa">{chart.duration/2}s</text><text x="785" y="248" textAnchor="end" fontSize="11" fill="#a1a1aa">{chart.duration}s</text>
      <path aria-label="Known-sample connecting guides" d={chart.linePath} fill="none" stroke="#22d3ee" strokeWidth="1" /><path aria-label="Every known source sample" d={chart.pointPath} fill="none" stroke="#e4e4e7" strokeWidth="3" />
      <line aria-label="Primary replay cursor on plot" x1={chart.x(time)} x2={chart.x(time)} y1="35" y2="225" stroke="#fbbf24" strokeDasharray="4 3" />
      {value !== null && <circle aria-label="Held source sample on plot" cx={chart.x(sample.time_s)} cy={chart.y(value)} r="5" fill={gap ? '#fbbf24' : '#22d3ee'} />}
    </svg></div>
    {!chart.count && <p role="status" className="text-xs text-amber-300">No known values for this channel. Empty plot is intentional, not zero readings. Navigation still seeks actual source rows.</p>}
    <p aria-label="Chart selected source evidence" className="text-xs text-zinc-300">Data row {index + 1}/{log.samples.length} at original {sample.time_s}s; source value {value === null ? 'unknown' : `${value} ${metadata.unit}`}. Replay cursor {time.toFixed(3)}s, held-sample age {(time-sample.time_s).toFixed(3)}s. {gap ? 'DATA GAP: held earlier row, not an observation at cursor time.' : 'Cursor line is playback time; highlighted dot is the original sample timestamp, never an interpolated value.'}</p>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={!index} onClick={() => seek(index-1)}>Previous chart sample</button><button className={button} disabled={index === log.samples.length-1} onClick={() => seek(index+1)}>Next chart sample</button><button className={button} onClick={download}>Download channel evidence</button></div>
    <p className="text-xs text-zinc-500">Scroll the plot horizontally on narrow screens. Source and reviews unchanged. No chart zoom/cropping/downsampling or external chart requests. Dense points may overlap visually; exact source-row navigation and complete text export retain every row. This chart recomputes from primary CSV and does not add state to portable cases or backend records.</p>
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}{message && <p role="status" className="text-xs text-cyan-200">{message}</p>}
  </article>;
}
