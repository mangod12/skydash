import SourceStepping from './SourceStepping';
import RecordedBlocks from './RecordedBlocks';
import RecordedChannelRanks from './RecordedChannelRanks';
import ReviewFocus from './ReviewFocus';
import { reviewPanelVisible } from '../../utils/reviewFocus';
import FlightComparison from './FlightComparison';
import InstructorDebrief from './InstructorDebrief';
import DebriefActions from './DebriefActions';
import DebriefChecklist from './DebriefChecklist';
import DebriefFollowup from './DebriefFollowup';
import TrainingEnvelope from './TrainingEnvelope';
import ReviewCase from './ReviewCase';
import SourceEvidence from './SourceEvidence';
import JointChannelEvidence from './JointChannelEvidence';
import AdjacentChannelChanges from './AdjacentChannelChanges';
import SourceRowLedger from './SourceRowLedger';
import ReviewWindow from './ReviewWindow';
import ReferenceCircle from './ReferenceCircle';
import { windowPlaybackRange,advanceWindowPlayback } from '../../utils/windowPlayback';
import RecordedChannelChart from './RecordedChannelChart';
import CSVColumnMapping from './CSVColumnMapping';
import LocalReviewLibrary from './LocalReviewLibrary';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { ArrowLeft, Download, Play, Pause, RotateCcw, Save, Upload } from 'lucide-react';
import RecordedBasemapLayer, { RecordedBasemapControl } from './RecordedBasemap';
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
  const debriefRef = useRef(null);
  const actionsRef = useRef(null), checklistRef = useRef(null);
  const [followupSeed, setFollowupSeed] = useState(null), [followupRevision, setFollowupRevision] = useState(0);
  const envelopeRef = useRef(null);
  const [reviewSeed, setReviewSeed] = useState(null);
  const [reviewRevision, setReviewRevision] = useState(0);
  const [log, setLog] = useState(null);
  const [panelFocus, setPanelFocus] = useState('all');
  const [pendingSection, setPendingSection] = useState(null);
  const changeFocus = value => { setPlaying(false); setPlaybackWindow(null); setPanelFocus(value); setPendingSection(null); };
  const navigateSection = (id, group) => { setPlaying(false); setPlaybackWindow(null); if (group && panelFocus !== 'all' && panelFocus !== group) setPanelFocus(group); setPendingSection({ id }); };
  useEffect(() => {
    if (pendingSection) document.getElementById(pendingSection.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pendingSection, panelFocus]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackWindow,setPlaybackWindow]=useState(null);
  const [basemapEnabled, setBasemapEnabled] = useState(false);
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
  const replaying = playing && (playbackWindow ? playbackWindow.repeat || time < playbackWindow.end : !atEnd);
  useEffect(() => {
    if (!replaying || !summary) return undefined;
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); const delta = (now - previous) / 1000; previous = now; setTime(value => playbackWindow ? advanceWindowPlayback(value,delta*speed,playbackWindow) : Math.min(summary.durationS, value + delta * speed)); }, 100);
    return () => clearInterval(timer);
  }, [replaying, speed, summary, playbackWindow]);
  const playWindow=(first,last,label,repeat)=>{if(busy||!log)return;try{const range=windowPlaybackRange(log,first,last,label,repeat);setPlaybackWindow(range);setTime(range.start);setPlaying(true);setError('');setMessage('Selected-window primary playback started at original source time. No gap skipping or source edits. Comparison playback and reviews unchanged.');}catch(failure){setError(failure.message||'Selected-window playback could not start.');}};
  const select = data => { setPanelFocus('all'); setPendingSection(null); setFollowupSeed(null); setBasemapEnabled(false); if (data.sha256 !== log?.sha256) setReviewSeed(null); setLog(data); setTitle(data.title); setNotes(data.notes || ''); setTime(0); setPlaying(false); setPlaybackWindow(null); setConfirmDelete(false); };
  const followupSnapshot = () => { if (busy || !log || !actionsRef.current || !checklistRef.current) throw new Error('Wait for source and follow-up panels to finish loading.'); return { actions: actionsRef.current.snapshot(), checklist: checklistRef.current.snapshot() }; };
  const applyFollowup = packet => { setFollowupSeed({ sha256: log.sha256, reviewRevision, packet }); setFollowupRevision(value => value + 1); };
  const currentFollowup = followupSeed?.sha256 === log?.sha256 && followupSeed?.reviewRevision === reviewRevision ? followupSeed.packet : null;
  const caseSnapshot = () => {
    if (busy || !log || !debriefRef.current || !envelopeRef.current) throw new Error('Wait for source loading to finish before exporting a case.');
    return { log, review: { title: title.trim(), notes }, debrief: debriefRef.current.snapshot(), envelope: envelopeRef.current.snapshot() };
  };
  const openCase = opened => {
    select(opened.log); setReviewSeed(opened.data); setReviewRevision(value => value + 1);
    setMessage('Portable case opened in this browser only. No server archive record created.');
  };
  const openMapped = converted => {
    select({ filename: converted.filename, csv_text: converted.csv_text, sha256: converted.sha256, samples: converted.samples, model_version: converted.model_version, title: converted.filename.replace(/\.csv$/i, ''), notes: '' });
    setReviewSeed(null); setReviewRevision(value => value + 1);
    setMessage('Mapped CSV opened locally. Keep original source and conversion record separately; no server record created.');
  };
  const run = async operation => {
    if (busy) return;
    setBusy(true); setPlaying(false); setPlaybackWindow(null); setError(''); setMessage('');
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
      {log && <ReviewFocus focus={panelFocus} onChange={changeFocus} onNavigate={navigateSection} disabled={busy} />}
      <details className="rounded-xl border border-orange-500/20 p-3"><summary className="cursor-pointer text-xs text-orange-200">Map another numeric CSV (explicit columns and units)</summary><div className="mt-3"><CSVColumnMapping workspaceBusy={busy} onOpen={openMapped} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} /></div></details>
      <details className="rounded-xl border border-fuchsia-500/20 p-3"><summary className="cursor-pointer text-xs text-fuchsia-200">Device-local review library (explicit storage, not a backup)</summary><div className="mt-3"><LocalReviewLibrary hasSource={Boolean(log)} workspaceBusy={busy} getSnapshot={caseSnapshot} onOpen={openCase} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} /></div></details>
      <ReviewCase workspaceBusy={busy} log={busy ? null : log} getSnapshot={caseSnapshot} onOpen={openCase} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} />
      <div className="grid gap-4 lg:grid-cols-3">
        <aside className="min-w-0 space-y-4">
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">1. Preview a single-aircraft CSV</h2>
            <p className="text-xs leading-relaxed text-zinc-400">CSV and notes stay in this browser until you choose Save to server. External background map tiles are off by default. Enabling a recorded-review basemap discloses the viewed area to its provider. A new preview or opening a record replaces your unsaved draft. Direct binary MAVLink and PX4 ULog imports are not supported. Use the explicit column mapper above for other numeric CSVs, or convert offline into this schema.</p>
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
              <label className="block text-xs text-zinc-400">Replay position: {time.toFixed(1)}s / {summary.durationS}s<input aria-label="Replay position" type="range" min="0" max={summary.durationS} step="0.1" value={time} onChange={event => { setPlaying(false); setPlaybackWindow(null); setTime(Number(event.target.value)); }} className="mt-2 w-full accent-cyan-400" /></label>
              <div className="flex flex-wrap gap-2 items-center">
                <button disabled={busy || atEnd} onClick={() => { setPlaybackWindow(null); setPlaying(!replaying); }} className={button}>{replaying ? <Pause size={14} /> : <Play size={14} />}{replaying ? 'Pause replay' : 'Play replay'}</button>
                <button onClick={() => { setPlaying(false); setPlaybackWindow(null); setTime(0); }} className={button}><RotateCcw size={14} /> Reset replay</button>
                <label className="text-xs text-zinc-400">Playback speed<select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="ml-2 rounded bg-zinc-900 p-2">{[1, 2, 4, 8].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>
              </div>
              {playbackWindow&&<div aria-label="Active selected-window playback" className="rounded border border-cyan-500/30 p-3 space-y-2 text-xs text-cyan-200"><p className="break-words">{playbackWindow.repeat?'REPEATING SELECTED WINDOW':'ONE-PASS SELECTED WINDOW'}: {playbackWindow.label}. Original rows {playbackWindow.first+1} through {playbackWindow.last+1}, original {playbackWindow.start}s to {playbackWindow.end}s. {replaying?'Playing recorded clock.':'Stopped at selected final timestamp.'} Gaps are held, not skipped. Final endpoint shown for at least one timer tick before repeat. Browser timer cadence is approximate, not telemetry or a new source.</p><button className={button} onClick={()=>{setPlaying(false);setPlaybackWindow(null);setMessage('Selected-window playback stopped. Cursor kept at current original time. Full-source replay controls restored.');}}>Stop selected-window playback</button><p>Stop, scrub, reset, global play/pause, actions that pause or seek primary replay cancel the bound. Starting a window always restarts at its original first timestamp. Comparison clock and source/review data unchanged. Session-only, not saved in portable artifacts/library.</p></div>}
              <p className="text-xs text-zinc-400" aria-label="Current recorded observation">Sample {index + 1}/{summary.count} at {current.time_s}s / {current.latitude.toFixed(5)}, {current.longitude.toFixed(5)} / altitude {reading(current.altitude_m, 'm')} / speed {reading(current.ground_speed_m_s, 'm/s')} / battery {reading(current.battery_pct, '%')}</p>
              <SourceStepping log={log} time={time} disabled={busy} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} />
              <p className={`text-xs ${inGap ? 'text-amber-300' : 'text-zinc-500'}`}>{inGap ? 'DATA GAP. ' : ''}Holding observation from {current.time_s}s; age {(time - current.time_s).toFixed(1)}s. {next ? `Next sample at ${next.time_s}s.` : 'Final sample reached.'}</p>
              <RecordedBasemapControl enabled={basemapEnabled} onChange={setBasemapEnabled} label="primary replay" />
              <div className="h-80 overflow-hidden rounded-lg border border-white/10" aria-label="Recorded flight track">
                <MapContainer center={point(log.samples[0])} zoom={15} className="h-full w-full" style={{ background: '#09090b' }}>
                  <RecordedBasemapLayer enabled={basemapEnabled} />
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
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="RecordedChannelChart"><RecordedChannelChart key={`chart-${log.sha256}-${reviewRevision}`} log={log} time={time} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div id="selected-sample-window" hidden={!reviewPanelVisible(panelFocus, 'interval')} data-review-panel="ReviewWindow"><ReviewWindow key={`window-${log.sha256}-${reviewRevision}`} onPlayWindow={playWindow} playbackDisabled={busy} log={log} time={time} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'interval')} data-review-panel="ReferenceCircle"><ReferenceCircle key={`circle-${log.sha256}-${reviewRevision}`} log={log} time={time} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="SourceRowLedger"><SourceRowLedger key={`ledger-${log.sha256}-${reviewRevision}`} log={log} time={time} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="SourceEvidence"><SourceEvidence key={`evidence-${log.sha256}-${reviewRevision}`} log={log} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="JointChannelEvidence"><JointChannelEvidence key={`joint-${log.sha256}-${reviewRevision}`} log={log} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="RecordedBlocks"><RecordedBlocks key={`blocks-${log.sha256}-${reviewRevision}`} log={log} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="RecordedChannelRanks"><RecordedChannelRanks key={`ranks-${log.sha256}-${reviewRevision}`} log={log} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'source')} data-review-panel="AdjacentChannelChanges"><AdjacentChannelChanges key={`changes-${log.sha256}-${reviewRevision}`} log={log} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'interval')} data-review-panel="TrainingEnvelope"><TrainingEnvelope ref={envelopeRef} initialReview={reviewSeed?.envelope || null} key={`envelope-${log.sha256}-${reviewRevision}`} log={log} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'debrief')} data-review-panel="InstructorDebrief"><InstructorDebrief ref={debriefRef} initialReview={reviewSeed?.debrief || null} key={`instructor-${log.sha256}-${reviewRevision}`} log={log} time={time} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'debrief')} data-review-panel="DebriefFollowup"><DebriefFollowup onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); document.querySelector('[aria-label="Recorded replay controls"]')?.scrollIntoView({ behavior: 'smooth' }); }} key={`followup-${log.sha256}-${reviewRevision}`} log={log} workspaceBusy={busy} getSnapshot={followupSnapshot} onApply={applyFollowup} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'debrief')} data-review-panel="DebriefActions"><DebriefActions ref={actionsRef} initialReview={currentFollowup?.actions || null} key={`actions-${log.sha256}-${reviewRevision}-${followupRevision}`} log={log} time={time} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <div hidden={!reviewPanelVisible(panelFocus, 'debrief')} data-review-panel="DebriefChecklist"><DebriefChecklist ref={checklistRef} initialReview={currentFollowup?.checklist || null} key={`checklist-${log.sha256}-${reviewRevision}-${followupRevision}`} log={log} time={time} disabled={busy} onPause={() => { setPlaying(false); setPlaybackWindow(null); }} onSeek={value => { setPlaying(false); setPlaybackWindow(null); setTime(value); }} /></div>
            <FlightComparison key={`comparison-${log.sha256}-${reviewRevision}`} primary={{ ...log, title: title.trim(), notes }} />
          </> : <div className="rounded-xl border border-dashed border-white/10 p-8 text-sm text-zinc-500">Choose a CSV, load the synthetic sample, or reopen a server record to replay and debrief. This view does not change the live fleet or Scenario Lab scores.</div>}
        </div>
      </div>
    </div>
  </section>;
}
