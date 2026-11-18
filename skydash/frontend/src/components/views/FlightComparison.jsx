import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { Download, Play, Pause, RotateCcw } from 'lucide-react';
import { DARK_BASEMAP } from '../../utils/basemap';
import { LOG_VERSION, LOG_HEADER, MAX_LOG_BYTES, parseFlightCSV, flightCSVHash } from '../../utils/flightLog';
import { COMPARISON_SCOPE, COMPARISON_METRICS, compareFlights, comparisonReport } from '../../utils/flightComparison';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed';
const point = sample => [sample.latitude, sample.longitude];
const show = (value, unit = '', signed = false) => value === null ? 'unknown' : `${signed && value > 0 ? '+' : ''}${value.toFixed(1)}${unit}`;
const syntheticBaseline = `${LOG_HEADER}\n0,28.61390,77.20900,8,0,96\n2,28.61400,77.20910,18,4,95\n4,28.61410,77.20920,28,5,94\n6,28.61420,77.20930,30,6,93\n8,28.61430,77.20940,32,5,92\n10,28.61440,77.20950,25,0,91\n`;
function FitComparison({ a, b }) {
  const map = useMap();
  useEffect(() => { map.fitBounds([...a, ...b].map(point), { padding: [35, 35], maxZoom: 17 }); }, [a, b, map]);
  return null;
}
function Observation({ observation, label, color }) {
  return <div className="rounded-lg border border-white/10 p-3 min-w-0">
    <p className={`text-xs font-semibold ${color}`}>{label}</p>
    {observation.sample ? <><p className="mt-1 text-xs text-zinc-300">Sample {observation.index + 1} at {observation.sample.time_s}s / age {observation.ageS.toFixed(1)}s</p><p className="mt-1 text-xs text-zinc-400">Altitude {show(observation.sample.altitude_m, 'm')}, speed {show(observation.sample.ground_speed_m_s, 'm/s')}, battery {show(observation.sample.battery_pct, '%')}</p><p className="mt-1 text-xs text-zinc-500">{observation.sample.latitude.toFixed(5)}, {observation.sample.longitude.toFixed(5)}</p>{observation.state === 'gap' && <p className="mt-1 text-xs text-amber-300">DATA GAP: held observation, no instantaneous deltas.</p>}</> : <p className="mt-1 text-xs text-amber-300">OUTSIDE SOURCE: no observation. Marker hidden, no instantaneous deltas.</p>}
  </div>;
}
export default function FlightComparison({ primary }) {
  const [baseline, setBaseline] = useState(null);
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const comparison = useMemo(() => baseline ? compareFlights(primary, baseline, time) : null, [primary, baseline, time]);
  const end = comparison?.maxDurationS;
  const replaying = playing && time < end;
  useEffect(() => {
    if (!replaying) return undefined;
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); const delta = (now - previous) / 1000; previous = now; setTime(value => Math.min(end, value + delta * speed)); }, 100);
    return () => clearInterval(timer);
  }, [replaying, end, speed]);
  const load = async (read, filename) => {
    if (busy) return;
    setBusy(true); setPlaying(false); setError(''); setMessage('');
    try {
      const csv_text = await read();
      const samples = parseFlightCSV(csv_text), sha256 = await flightCSVHash(csv_text);
      setBaseline({ title: filename.replace(/\.csv$/i, '').slice(0, 120), filename: filename.slice(0, 120), csv_text, samples, sha256, model_version: LOG_VERSION });
      setTime(0); setNotes(''); setMessage('Baseline B loaded locally. No CSV or notes uploaded. Comparison reset to 0s; prior comparison notes replaced.');
    } catch (failure) { setError(failure.message || 'Baseline could not be read.'); }
    finally { setBusy(false); }
  };
  const fileChosen = event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    load(async () => { if (file.size > MAX_LOG_BYTES) throw new Error('CSV must be at most 1MiB.'); return new globalThis.TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()); }, file.name);
  };
  const download = kind => {
    let url;
    try {
      const text = kind === 'baseline' ? baseline.csv_text : comparisonReport(primary, baseline, notes);
      url = URL.createObjectURL(new Blob([text], { type: kind === 'baseline' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = kind === 'baseline' ? `skydash-baseline-${baseline.sha256.slice(0, 12)}.csv` : `skydash-comparison-${primary.sha256.slice(0, 8)}-${baseline.sha256.slice(0, 8)}.txt`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError(''); setMessage('Download requested. Keep the comparison report and both source CSVs; they contain location data.');
    } catch { if (url) URL.revokeObjectURL(url); setError('Comparison download could not start. Sources and notes are unchanged.'); }
  };
  const clear = () => { setBaseline(null); setNotes(''); setTime(0); setPlaying(false); setError(''); setMessage('Comparison cleared. Primary A is unchanged.'); };
  return <article id="flight-comparison" aria-label="Two-flight comparison" className="rounded-xl border border-violet-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-violet-300">TRAINING / COMPARE RECORDED SORTIES</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">4. Two-flight comparison</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{COMPARISON_SCOPE}</p></header>
    <p className="text-xs text-zinc-400 break-all">Primary A: {primary.title} / {primary.filename}. Import a second CSV as baseline B. Uses the same numeric schema and limits as the primary. Loading another baseline replaces comparison notes. Changing primary clears the comparison. No server archive is needed.</p>
    <label className="block text-xs text-zinc-300">Baseline CSV<input aria-label="Choose baseline CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={fileChosen} className="mt-2 block w-full min-w-0 text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-violet-950 file:p-2 file:text-violet-200" /></label>
    <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => load(async () => syntheticBaseline, 'synthetic-baseline.csv')} className={button}>Load synthetic baseline</button>{baseline && <button disabled={busy} onClick={clear} className={button}>Clear comparison</button>}</div>
    {busy && <p className="text-xs text-zinc-400" aria-live="polite">Reading baseline...</p>}{error && <p role="alert" className="text-xs text-amber-300">{error} Previous comparison remains unchanged.</p>}{message && <p role="status" className="text-xs text-violet-200">{message}</p>}
    {comparison && <>
      {comparison.identicalSource && <p role="alert" className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-300">IDENTICAL SOURCE CHECKSUMS. This is the same source, not an independent flight comparison.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"><p className="text-cyan-300 break-all">A / {primary.filename}<span className="block text-[10px] text-zinc-500">SHA-256 {primary.sha256}</span></p><p className="text-violet-300 break-all">B / {baseline.filename}<span className="block text-[10px] text-zinc-500">SHA-256 {baseline.sha256}</span></p></div>
      <p className="text-xs text-zinc-400">Shared elapsed-time range: 0 to {comparison.commonDurationS}s. The cursor continues to {end}s so shorter-source boundaries are explicit. This cursor is independent of the primary replay above.</p>
      <label className="block text-xs text-zinc-300">Comparison time: {time.toFixed(1)}s<input aria-label="Comparison time" type="range" min="0" max={end} step="0.1" value={time} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} className="mt-2 w-full accent-violet-400" /></label>
      <div className="flex flex-wrap gap-2 items-center"><button disabled={busy || time >= end} onClick={() => setPlaying(value => !value)} className={button}>{replaying ? <Pause size={14} /> : <Play size={14} />}{replaying ? 'Pause comparison' : 'Play comparison'}</button><button onClick={() => { setPlaying(false); setTime(0); }} className={button}><RotateCcw size={14} /> Reset comparison</button><label className="text-xs text-zinc-400">Comparison speed<select aria-label="Comparison speed" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="ml-2 rounded bg-zinc-900 p-2">{[1, 2, 4, 8].map(value => <option key={value} value={value}>{value}x</option>)}</select></label></div>
      <div aria-label="Paired recorded observations" className="grid gap-2 sm:grid-cols-2"><Observation observation={comparison.primaryObservation} label="PRIMARY A" color="text-cyan-300" /><Observation observation={comparison.baselineObservation} label="BASELINE B" color="text-violet-300" /></div>
      <p aria-label="Instantaneous observation deltas" className="text-xs text-zinc-400">Held-observation A minus B: altitude {show(comparison.currentDeltas.altitude, 'm', true)}, speed {show(comparison.currentDeltas.speed, 'm/s', true)}, battery {show(comparison.currentDeltas.battery, '%', true)}. Unequal sample ages are shown above; no interpolation or physical-time synchronization.</p>
      <div className="h-80 overflow-hidden rounded-lg border border-white/10" aria-label="Compared recorded tracks"><MapContainer center={point(primary.samples[0])} zoom={15} className="h-full w-full" style={{ background: '#09090b' }}><TileLayer url={DARK_BASEMAP.url} attribution={DARK_BASEMAP.attribution} className={DARK_BASEMAP.className} maxZoom={DARK_BASEMAP.maxZoom} maxNativeZoom={DARK_BASEMAP.maxNativeZoom} /><FitComparison a={primary.samples} b={baseline.samples} />{[['primary', '#22d3ee', 'A'], ['baseline', '#a78bfa', 'B']].map(([key, color, label]) => <Fragment key={key}>{comparison[key].segments.map((segment, index) => <Polyline key={index} positions={segment.map(point)} pathOptions={{ color, weight: 3, dashArray: key === 'baseline' ? '6 4' : undefined }} />)}{comparison[`${key}Observation`].sample && <CircleMarker center={point(comparison[`${key}Observation`].sample)} radius={key === 'primary' ? 8 : 5} pathOptions={{ color: comparison[`${key}Observation`].state === 'gap' ? '#fbbf24' : color, fillOpacity: 1 }}><Tooltip permanent direction={key === 'primary' ? 'top' : 'bottom'}>{label} {comparison[`${key}Observation`].sample.time_s}s</Tooltip></CircleMarker>}</Fragment>)}</MapContainer></div>
      <p className="text-[10px] text-zinc-500">Cyan A and purple B show complete recorded tracks, broken at intervals over 5s. Markers hold observations; amber means gap. Basemap providers receive map tile requests. No aircraft commands, location normalization or aviation data.</p>
      <div className="overflow-x-auto"><table aria-label="Whole-log metric comparison" className="w-full text-xs text-left"><caption className="text-left text-xs text-zinc-400 mb-2">Whole-log summaries, not restricted to shared time. A-B is a numeric difference, not better/worse.</caption><thead className="text-zinc-400"><tr><th className="p-2">Metric</th><th className="p-2">A</th><th className="p-2">B</th><th className="p-2">A-B</th></tr></thead><tbody>{COMPARISON_METRICS.map(({ key, label, unit }) => <tr key={key} className="border-t border-white/10 text-zinc-300"><th className="p-2 font-normal">{label}</th><td className="p-2 whitespace-nowrap">{show(comparison.primary[key], unit)}</td><td className="p-2 whitespace-nowrap">{show(comparison.baseline[key], unit)}</td><td className="p-2 whitespace-nowrap">{show(comparison.deltas[key], unit, true)}</td></tr>)}</tbody></table></div>
      <p className="text-[10px] text-zinc-500">Altitude observations A {comparison.primary.altitudeCount}/{comparison.primary.count}, B {comparison.baseline.altitudeCount}/{comparison.baseline.count}. Speed A {comparison.primary.speedCount}/{comparison.primary.count}, B {comparison.baseline.speedCount}/{comparison.baseline.count}. Battery A {comparison.primary.batteryCount}/{comparison.primary.count}, B {comparison.baseline.batteryCount}/{comparison.baseline.count}. Differences can reflect missing data and sample rates, not behavior.</p>
      <label className="block text-xs text-zinc-400">Comparison notes (analyst-authored)<textarea aria-label="Comparison notes" value={notes} maxLength={4000} rows={3} onChange={event => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200" /></label>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => download('report')} className={button}><Download size={14} /> Download comparison report</button><button disabled={busy} onClick={() => download('baseline')} className={button}><Download size={14} /> Download baseline CSV</button></div>
      <p className="text-xs text-zinc-500">Download primary CSV using the source button above. Comparison notes are not added to either saved server record. Closing this screen, changing primary or clearing removes this comparison.</p>
    </>}
  </article>;
}
