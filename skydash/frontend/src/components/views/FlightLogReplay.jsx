import FlightComparison from './FlightComparison';
import InstructorDebrief from './InstructorDebrief';
import TrainingEnvelope from './TrainingEnvelope';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { ArrowLeft, Download, Play, Pause, RotateCcw, Save, Upload } from 'lucide-react';
import { DARK_BASEMAP } from '../../utils/basemap';
import { apiFetch } from '../../utils/api';
import { API_BASE, API_CONFIGURED } from '../../utils/runtimeConfig';
import { useCan } from '../../hooks/useCan';
import { LOG_VERSION, LOG_HEADER, LOG_SCOPE, SAMPLE_LOG, MAX_LOG_BYTES, parseFlightCSV, flightCSVHash, sampleIndexAt, summarizeFlight, flightAfterAction } from '../../utils/flightLog';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed';
const input = 'mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200';
const point = sample => [sample.latitude, sample.longitude];
const reading = (value, unit) => value === null ? 'unknown' : `${value.toFixed(1)}${unit}`;
function FitTrack({ samples }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(samples.map(point), { padding: [30, 30], maxZoom: 17 }); }, [samples, map]);
  return null;
}
async function request(path = '', options) {
  const response = await apiFetch(`${API_BASE}/api/flight-logs${path}`, options);
  const body = await response.json();
  if (response.status === 404 && !path) throw new Error('This backend does not have the flight-log archive API. Update your self-hosted backend; local preview, replay and downloads still work.');
  if (!response.ok || !body.success) throw new Error(typeof body.detail === 'string' ? body.detail : body.error || 'Flight-log archive request failed.');
  return body.data;
}
async function verifiedRecord(data) {
  if (data.model_version !== LOG_VERSION) throw new Error('Unsupported saved replay model. Download with the matching SkyDash version.');
  const samples = parseFlightCSV(data.csv_text);
  if (await flightCSVHash(data.csv_text) !== data.sha256) throw new Error('Source checksum mismatch. This record was not opened.');
  return { ...data, samples };
}

export default function FlightLogReplay({ onBack }) {
  const canWrite = useCan('analyst');
  const [log, setLog] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [archive, setArchive] = useState([]);
  const [archiveReady, setArchiveReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const summary = useMemo(() => log ? summarizeFlight(log.samples) : null, [log]);
  const index = log ? sampleIndexAt(log.samples, time) : 0;
  const current = log?.samples[index];
  const next = log?.samples[index + 1];
  const inGap = next && next.time_s - current.time_s > 5 && time > current.time_s;
  const atEnd = Boolean(summary && time >= summary.durationS);
  const replaying = playing && !atEnd;
  useEffect(() => {
    if (!replaying || !summary) return undefined;
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); const delta = (now - previous) / 1000; previous = now; setTime(value => Math.min(summary.durationS, value + delta * speed)); }, 100);
    return () => clearInterval(timer);
  }, [replaying, speed, summary]);
  const select = data => { setLog(data); setTitle(data.title); setNotes(data.notes || ''); setTime(0); setPlaying(false); setConfirmDelete(false); };
  const run = async operation => {
    if (busy) return;
    setBusy(true); setPlaying(false); setError(''); setMessage('');
    try { await operation(); } catch (failure) { setError(failure.message || 'Operation failed.'); }
    finally { setBusy(false); }
  };
  const preview = (csv_text, filename) => run(async () => {
    const samples = parseFlightCSV(csv_text);
    const sha256 = await flightCSVHash(csv_text);
    select({ title: filename.replace(/\.csv$/i, ''), filename, notes: '', csv_text, samples, sha256, model_version: LOG_VERSION });
    setMessage('Local preview loaded. CSV and notes have not been uploaded. Previous draft was replaced.');
  });
  const fileChosen = event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    run(async () => {
      if (file.size > MAX_LOG_BYTES) throw new Error('CSV must be at most 1MiB. Previous preview is unchanged.');
      const csv_text = new globalThis.TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      const samples = parseFlightCSV(csv_text);
      const sha256 = await flightCSVHash(csv_text);
      select({ title: file.name.replace(/\.csv$/i, '').slice(0, 120), filename: file.name.slice(0, 120), notes: '', csv_text, samples, sha256, model_version: LOG_VERSION });
      setMessage('Local preview loaded. CSV and notes have not been uploaded. Previous draft was replaced.');
    });
  };
  const save = () => run(async () => {
    const data = await request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), filename: log.filename, notes, csv_text: log.csv_text }) });
    select(await verifiedRecord(data));
    setMessage('Saved to the server SQLite archive. Reopen from the archive after reload. Keep the database volume and backups.');
    // A failed list refresh must not hide a successful save or suggest retrying its write.
    setArchive(previous => [data, ...previous.filter(item => item.id !== data.id)]);
  });
  const refresh = () => run(async () => { setArchiveReady(false); setArchive(await request()); setArchiveReady(true); setMessage('Server archive refreshed. Open a record to replay its source and fixed notes.'); });
  const open = id => run(async () => { select(await verifiedRecord(await request(`/${encodeURIComponent(id)}`))); setMessage('Saved source checksum verified and replay reset to the first observation.'); });
  const remove = () => run(async () => {
    await request(`/${encodeURIComponent(log.id)}`, { method: 'DELETE' });
    setArchive(previous => previous.filter(item => item.id !== log.id)); select({ ...log, id: undefined, created_at: undefined });
    setMessage('Server record deleted. The source is still in this session for download, but is no longer saved.');
  });
  const download = (kind) => {
    let url;
    try {
      const text = kind === 'csv' ? log.csv_text : flightAfterAction({ ...log, title: title.trim(), notes });
      url = URL.createObjectURL(new Blob([text], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-flight-${log.sha256.slice(0, 12)}.${kind === 'csv' ? 'csv' : 'txt'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setError(''); setMessage('Download requested. The report and CSV contain source location data.');
    } catch { if (url) URL.revokeObjectURL(url); setError('Download could not start. Your source and report remain available.'); }
  };

  return <section aria-label="Flight log replay" className="h-full overflow-y-auto overflow-x-hidden bg-zinc-950 p-4">
    <div className="mx-auto max-w-7xl space-y-4">
      <button disabled={busy} onClick={onBack} className="inline-flex items-center gap-2 text-xs text-zinc-400"><ArrowLeft size={14} /> Back to Scenario Lab</button>
      <header><p className="text-[10px] tracking-widest text-cyan-300">IMPORT / REPLAY / DEBRIEF</p><h1 className="mt-1 text-2xl font-semibold text-zinc-100">Flight Log Replay</h1><p className="mt-2 text-xs leading-relaxed text-zinc-400">{LOG_SCOPE}</p></header>
      {log && <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setPlaying(false); document.getElementById('training-envelope')?.scrollIntoView({ behavior: 'smooth' }); }}>Training envelope</button><button className={button} onClick={() => { setPlaying(false); document.getElementById('instructor-debrief')?.scrollIntoView({ behavior: 'smooth' }); }}>Instructor debrief</button><button className={button} onClick={() => { setPlaying(false); document.getElementById('flight-comparison')?.scrollIntoView({ behavior: 'smooth' }); }}>Compare two flights</button></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <aside className="min-w-0 space-y-4">
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">1. Preview a single-aircraft CSV</h2>
            <p className="text-xs leading-relaxed text-zinc-400">CSV and notes stay in this browser until you choose Save to server. Map tiles are fetched from external providers for the viewed area. A new preview or opening a record replaces your unsaved draft. Direct binary MAVLink and PX4 ULog imports are not supported. Convert offline into this exact numeric schema first.</p>
            <code className="block break-all text-[10px] text-cyan-300">{LOG_HEADER}</code>
            <p className="text-xs text-zinc-500">UTF-8, unquoted numeric cells, 2 to 10,000 rows, 1MiB, up to 6 hours starting at 0s. Latitude within 85°; no dateline crossing. Optional altitude, speed and battery cells may be blank (unknown). Coordinates and time cannot be blank.</p>
            <label className="block text-xs text-zinc-300"><Upload size={14} className="inline mr-2" />Choose CSV<input aria-label="Choose flight CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={fileChosen} className="mt-2 block w-full min-w-0 text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-cyan-950 file:p-2 file:text-cyan-200" /></label>
            <button disabled={busy} onClick={() => preview(SAMPLE_LOG, 'synthetic-training-sample.csv')} className={button}>Load synthetic sample</button>
          </div>
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">Server archive ({archive.length}/50 loaded)</h2>
            <p className="text-xs text-zinc-500">Shared with users who can access this deployment. Saving uploads coordinates and notes. Use your own secured deployment for real logs. SQLite persistence needs a retained database volume and backups, not ephemeral hosting storage.</p>
            <button disabled={busy || !API_CONFIGURED} onClick={refresh} className={button}>Refresh server archive</button>
            {!archiveReady && API_CONFIGURED && <p className="text-xs text-amber-300">Server archive not connected. Refresh to check backend availability before saving. Older hosted backends do not provide this API; local replay and downloads remain available.</p>}
            {!API_CONFIGURED && <p className="text-xs text-amber-300">Backend not configured. Local preview, replay and downloads still work.</p>}
            <ul className="max-h-56 overflow-y-auto space-y-2">{archive.map(item => <li key={item.id}><button disabled={busy} onClick={() => open(item.id)} className="w-full rounded-lg border border-white/10 p-2 text-left text-xs text-zinc-300"><span className="block break-words">{item.title}</span><span className="text-[10px] text-zinc-500">{item.sample_count} samples / {item.duration_s}s / {item.sha256.slice(0, 12)}</span></button></li>)}</ul>
          </div>
        </aside>
        <div className="min-w-0 lg:col-span-2 space-y-4">
          {error && <p role="alert" className="rounded-xl border border-amber-500/30 p-3 text-xs text-amber-300">{error} No failed import replaces the current preview.</p>}
          {message && <p role="status" className="text-xs text-cyan-200">{message}</p>}
          {busy && <p className="text-xs text-zinc-400" aria-live="polite">Working...</p>}
          {log ? <>
            <article className="rounded-xl border border-white/10 p-4 space-y-3" aria-label="Recorded replay controls">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-zinc-200">2. Replay observations</h2><span className="text-[10px] text-amber-300">RECORDED / NOT LIVE {log.id ? '/ SERVER SAVED' : '/ SESSION ONLY'}</span></div>
              <p className="text-xs text-zinc-400 break-all">Source: {log.filename} / {LOG_VERSION}</p>
              <label className="block text-xs text-zinc-400">Replay position: {time.toFixed(1)}s / {summary.durationS}s<input aria-label="Replay position" type="range" min="0" max={summary.durationS} step="0.1" value={time} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} className="mt-2 w-full accent-cyan-400" /></label>
              <div className="flex flex-wrap gap-2 items-center">
                <button disabled={busy || atEnd} onClick={() => setPlaying(value => !value)} className={button}>{replaying ? <Pause size={14} /> : <Play size={14} />}{replaying ? 'Pause replay' : 'Play replay'}</button>
                <button onClick={() => { setPlaying(false); setTime(0); }} className={button}><RotateCcw size={14} /> Reset replay</button>
                <label className="text-xs text-zinc-400">Playback speed<select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="ml-2 rounded bg-zinc-900 p-2">{[1, 2, 4, 8].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>
              </div>
              <p className="text-xs text-zinc-400" aria-label="Current recorded observation">Sample {index + 1}/{summary.count} at {current.time_s}s / {current.latitude.toFixed(5)}, {current.longitude.toFixed(5)} / altitude {reading(current.altitude_m, 'm')} / speed {reading(current.ground_speed_m_s, 'm/s')} / battery {reading(current.battery_pct, '%')}</p>
              <p className={`text-xs ${inGap ? 'text-amber-300' : 'text-zinc-500'}`}>{inGap ? 'DATA GAP. ' : ''}Holding observation from {current.time_s}s; age {(time - current.time_s).toFixed(1)}s. {next ? `Next sample at ${next.time_s}s.` : 'Final sample reached.'}</p>
              <div className="h-80 overflow-hidden rounded-lg border border-white/10" aria-label="Recorded flight track">
                <MapContainer center={point(log.samples[0])} zoom={15} className="h-full w-full" style={{ background: '#09090b' }}>
                  <TileLayer url={DARK_BASEMAP.url} attribution={DARK_BASEMAP.attribution} className={DARK_BASEMAP.className} maxZoom={DARK_BASEMAP.maxZoom} maxNativeZoom={DARK_BASEMAP.maxNativeZoom} />
                  <FitTrack samples={log.samples} />
                  {summary.segments.map((segment, segmentIndex) => <Polyline key={segmentIndex} positions={segment.map(point)} pathOptions={{ color: '#22d3ee', weight: 3 }} />)}
                  <CircleMarker center={point(current)} radius={8} pathOptions={{ color: inGap ? '#fbbf24' : '#34d399', fillOpacity: 1 }}><Tooltip permanent direction="top">RECORDED {current.time_s}s</Tooltip></CircleMarker>
                </MapContainer>
              </div><p className="text-[10px] text-zinc-500">Cyan: complete recorded segments, not planned route. Missing intervals are not connected. Marker holds the last sample. Basemap is not aviation data.</p>
            </article>
            <article aria-label="Recorded-log after-action report" className="rounded-xl border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">3. Debrief and preserve</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Samples', summary.count], ['Duration', `${summary.durationS}s`], ['Connected distance', `${summary.distanceM.toFixed(1)}m`], ['Gaps over 5s', summary.gapCount]].map(([label, value]) => <div key={label}><p className="text-[10px] text-zinc-500">{label}</p><p className="text-lg font-mono text-cyan-200">{value}</p></div>)}</div>
              <p className="text-xs text-zinc-400">Max observed altitude {reading(summary.maxAltitudeM, 'm')} ({summary.altitudeCount}/{summary.count} samples). Max recorded speed {reading(summary.maxSpeedMps, 'm/s')}. Min recorded battery {reading(summary.minBatteryPct, '%')} ({summary.batteryCount}/{summary.count} samples). Largest interval {summary.largestGapS}s. No grades, causal claims or scenario scores inferred.</p>
              <label className="block text-xs text-zinc-400">Review title<input aria-label="Review title" maxLength={120} disabled={Boolean(log.id) || busy} value={title} onChange={event => setTitle(event.target.value)} className={input} /></label>
              <label className="block text-xs text-zinc-400">Analyst notes (not sensor observations)<textarea aria-label="Analyst notes" maxLength={4000} rows={3} disabled={Boolean(log.id) || busy} value={notes} onChange={event => setNotes(event.target.value)} className={input} /></label>
              <p className="text-[10px] text-zinc-500 break-all">Exact-source SHA-256: {log.sha256}. This detects source changes, not authenticity or tamper-evident custody. {log.id ? `Immutable saved record ${log.id}, ${log.created_at}.` : 'Unsaved preview is lost when this screen closes.'}</p>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy || !canWrite || !API_CONFIGURED || !archiveReady || Boolean(log.id) || !title.trim()} onClick={save} className={button}><Save size={14} /> Save to server</button>
                <button disabled={busy || !title.trim()} onClick={() => download('report')} className={button}><Download size={14} /> Download after-action report</button>
                <button disabled={busy} onClick={() => download('csv')} className={button}><Download size={14} /> Download source CSV</button>
                {log.id && canWrite && <button disabled={busy} onClick={() => setConfirmDelete(value => !value)} className={button}>Delete server record</button>}
              </div>
              {!canWrite && <p className="text-xs text-amber-300">Analyst role required to save or delete shared records.</p>}
              {confirmDelete && <div className="text-xs text-amber-300">Permanently delete this server log and its fixed notes? Download both first if needed.<div className="mt-2 flex gap-2"><button disabled={busy} onClick={remove} className={button}>Confirm delete record</button><button disabled={busy} onClick={() => setConfirmDelete(false)} className={button}>Keep record</button></div></div>}
            </article>
            <TrainingEnvelope key={`envelope-${log.sha256}`} log={log} onPause={() => setPlaying(false)} onSeek={value => { setPlaying(false); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} />
            <InstructorDebrief key={`instructor-${log.sha256}`} log={log} time={time} onPause={() => setPlaying(false)} onSeek={value => { setPlaying(false); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} />
            <FlightComparison key={`comparison-${log.sha256}`} primary={{ ...log, title: title.trim(), notes }} />
          </> : <div className="rounded-xl border border-dashed border-white/10 p-8 text-sm text-zinc-500">Choose a CSV, load the synthetic sample, or reopen a server record to replay and debrief. This view does not change the live fleet or Scenario Lab scores.</div>}
        </div>
      </div>
    </div>
  </section>;
}
