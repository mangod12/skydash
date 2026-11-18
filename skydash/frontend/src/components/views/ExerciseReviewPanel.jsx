import { useState } from 'react';
import { Archive, Download, RotateCcw, GitCompareArrows, Trash2 } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { buildScenarioFrame, formatScenarioTime, INJECTION_EVENTS } from '../../utils/scenarioEngine';
import { captureExerciseReview, readExerciseArchive, writeExerciseArchive, exerciseComparison, formatExerciseReview, EXERCISE_SCOPE, MAX_EXERCISE_REVIEWS } from '../../utils/exerciseReview';

const labels = { coverage: 'Coverage', batteryReserve: 'Battery reserve', riskReduced: 'Risk-reduction score', detections: 'Detections' };
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed';
function browserArchive() {
  try { return readExerciseArchive(localStorage); }
  catch { return { reviews: [], error: 'Browser storage is unavailable. Reviews cannot be saved here.' }; }
}

export default function ExerciseReviewPanel() {
  const status = useScenarioStore(s => s.status);
  const elapsedSeconds = useScenarioStore(s => s.elapsedSeconds);
  const [archive, setArchive] = useState(browserArchive);
  const [selectedId, setSelectedId] = useState('');
  const [baselineId, setBaselineId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const selected = archive.reviews.find(item => item.id === selectedId);
  const baseline = archive.reviews.find(item => item.id === baselineId);
  const frame = selected ? buildScenarioFrame(selected.configuration) : null;
  const comparison = selected && baseline ? exerciseComparison(selected, baseline) : null;
  const baselineFrame = baseline ? buildScenarioFrame(baseline.configuration) : null;
  const canSave = ['paused', 'complete'].includes(status) && elapsedSeconds > 0 && title.trim() && !archive.error && archive.reviews.length < MAX_EXERCISE_REVIEWS;

  const save = () => {
    try {
      if (archive.error) throw new Error('Resolve the archive read error before saving.');
      if (archive.reviews.length >= MAX_EXERCISE_REVIEWS) throw new Error('Archive full. Download and delete an old review first.');
      const review = captureExerciseReview(useScenarioStore.getState(), { id: crypto.randomUUID(), title, notes });
      const reviews = [review, ...archive.reviews];
      // Persist before showing success. Failed writes keep the form intact.
      writeExerciseArchive(localStorage, reviews, archive.reviews);
      setArchive({ reviews, error: '' }); setSelectedId(review.id); setBaselineId(''); setTitle(''); setNotes('');
      setMessage('Review saved in this browser. It survives an ordinary reload, not browser-data deletion.');
    } catch (error) { setMessage(error.message || 'Could not save. Your draft is still in the form.'); }
  };
  const remove = () => {
    try {
      writeExerciseArchive(localStorage, archive.reviews.filter(item => item.id !== selectedId), archive.reviews);
      setArchive(value => ({ ...value, reviews: value.reviews.filter(item => item.id !== selectedId) }));
      setSelectedId(''); setConfirmLoad(false); setMessage('Selected review deleted from this browser.');
    } catch (error) { setMessage(error.message || 'Delete failed. The saved review has not been removed.'); }
  };
  const clear = () => {
    try {
      writeExerciseArchive(localStorage, []); setArchive({ reviews: [], error: '' }); setSelectedId(''); setBaselineId('');
      setConfirmClear(false); setConfirmLoad(false); setMessage('Local exercise archive cleared.');
    } catch { setMessage('Could not clear browser storage. No success was recorded.'); }
  };
  const load = () => {
    if (!selected) return;
    useScenarioStore.getState().loadReview(selected);
    setConfirmLoad(false); setMessage('Saved configuration loaded for review. Simulation is paused or complete; no aircraft commands were sent.');
  };
  const download = () => {
    if (!selected) return;
    let url;
    try {
      url = URL.createObjectURL(new Blob([formatExerciseReview(selected, baseline)], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-exercise-review-${selected.savedAt}.txt`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Review download requested. The saved review is unchanged.');
    } catch { if (url) URL.revokeObjectURL(url); setMessage('Download could not start. The saved review remains in the archive.'); }
  };

  return <section id="exercise-review" aria-label="Exercise after-action review" className="rounded-xl border border-cyan-500/20 bg-zinc-950/50 p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold tracking-[0.16em] text-cyan-300">TRAINING / LOCAL ARCHIVE</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">Exercise After-Action Review</h2></div><span className="text-xs font-mono text-zinc-500">{archive.reviews.length}/{MAX_EXERCISE_REVIEWS} saved</span></div>
    <p className="text-xs leading-relaxed text-zinc-400">{EXERCISE_SCOPE}</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-white/10 p-3 space-y-3">
        <h3 className="text-sm font-medium text-zinc-200">1. Capture a review</h3>
        <p className="text-xs text-zinc-500">Pause a progressed exercise or finish it. Saving captures this simulation time, fleet and active injected conditions. Seeking is allowed and is not proof of completed training.</p>
        <label className="block text-xs text-zinc-400">Review title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Baseline thermal-search exercise" className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200" /></label>
        <label className="block text-xs text-zinc-400">Lessons and follow-up (self-reported)<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="What changed? What should be tested next?" className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200" /></label>
        <button onClick={save} disabled={!canSave} className={button}><Archive size={14} /> Save exercise review</button>
        <p className="text-[11px] text-zinc-500">Current state: {status}; simulation time {formatScenarioTime(elapsedSeconds)}. Saving does not reset the exercise.</p>
      </div>
      <div className="rounded-lg border border-white/10 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-zinc-200">2. Reopen and compare</h3><button className={button} onClick={() => { setArchive(browserArchive()); setConfirmLoad(false); setMessage('Archive refreshed. Your unsaved notes are unchanged.'); }}>Refresh archive</button></div>
        <label className="block text-xs text-zinc-400">Saved review<select aria-label="Saved review" value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirmLoad(false); }} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200"><option value="">Select a saved review</option>{archive.reviews.map(review => <option key={review.id} value={review.id}>{review.title} | {new Date(review.savedAt).toISOString()}</option>)}</select></label>
        <label className="block text-xs text-zinc-400">Comparison baseline<select aria-label="Comparison baseline" value={baselineId} onChange={event => setBaselineId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200"><option value="">No comparison</option>{archive.reviews.filter(review => review.id !== selectedId).map(review => <option key={review.id} value={review.id}>{review.title}</option>)}</select></label>
        <div className="flex flex-wrap gap-2"><button disabled={!selected} onClick={download} className={button}><Download size={14} /> Export review</button><button disabled={!selected} onClick={() => setConfirmLoad(true)} className={button}><RotateCcw size={14} /> Load saved exercise</button><button disabled={!selected} onClick={remove} className={button}><Trash2 size={14} /> Delete selected</button></div>
        {confirmLoad && <div className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-200">Replace the current in-progress simulation with this saved configuration? Unsaved simulation progress will be lost.<div className="mt-2 flex flex-wrap gap-2"><button className={button} onClick={load}>Replace simulation</button><button className={button} onClick={() => setConfirmLoad(false)}>Cancel load</button></div></div>}
        {!archive.reviews.length && <p className="text-xs text-zinc-500">No saved reviews yet. Save two snapshots of the same scenario at the same simulation time to compare them.</p>}
      </div>
    </div>
    {archive.error && <p role="alert" className="text-xs text-amber-300">{archive.error}</p>}
    {message && <p role="status" className="rounded-lg border border-white/10 p-3 text-xs text-zinc-300">{message}</p>}
    {selected && <article className="rounded-lg border border-white/10 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-zinc-100 break-words">{selected.title}</h3><p className="mt-1 text-xs text-zinc-500">{selected.scenarioName} / {selected.presetName} / {formatScenarioTime(frame.elapsedSeconds)} / {selected.status}</p></div><span className="text-xs font-mono text-cyan-300">MODEL GRADE {selected.scorecard.grade}</span></div>
      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400">{selected.notes || 'No reviewer notes.'}</p>
      <p className="text-xs text-zinc-500">Active conditions: {selected.configuration.injectedEvents.map(item => `${INJECTION_EVENTS.find(inject => inject.id === item.id).label} at ${formatScenarioTime(item.injectedAt)}`).join('; ') || 'none'}. Saved {new Date(selected.savedAt).toISOString()}.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.keys(labels).map(key => <div key={key} className="rounded-lg bg-white/[0.03] p-2"><p className="text-[11px] text-zinc-500">{labels[key]}</p><p className="mt-1 font-mono text-sm text-zinc-200">{selected.scorecard[key]}{key === 'detections' ? '' : '%'}</p></div>)}</div>
      {comparison && <div className="rounded-lg border border-indigo-500/20 p-3 space-y-2"><h4 className="flex gap-2 items-center text-sm text-indigo-200"><GitCompareArrows size={16} /> Compared with {baseline.title}</h4><p className="text-xs text-zinc-400">Baseline: {baseline.scenarioName} / {baseline.presetName} / {formatScenarioTime(baselineFrame.elapsedSeconds)}. Conditions: {baseline.configuration.injectedEvents.map(item => `${INJECTION_EVENTS.find(inject => inject.id === item.id).label} at ${formatScenarioTime(item.injectedAt)}`).join('; ') || 'none'}.</p>{comparison.error ? <p className="text-xs text-amber-300">{comparison.error}</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{comparison.deltas.map(item => <div key={item.key}><p className="text-[11px] text-zinc-500">{labels[item.key]}</p><p className="text-sm font-mono text-indigo-200">{item.delta >= 0 ? '+' : ''}{item.delta} {item.key === 'detections' ? 'count' : 'pp'}</p><p className="text-[10px] text-zinc-500">{item.current} vs {item.baseline}</p></div>)}</div>}<p className="text-[11px] text-zinc-500">Same scenario and simulation time required. Differences describe the model, not causation or field performance. Review fleet and injected-condition differences too.</p></div>}
    </article>}
    <div className="border-t border-white/5 pt-3"><button onClick={() => setConfirmClear(value => !value)} className="text-[11px] text-zinc-500 hover:text-red-300">Clear local exercise archive</button>{confirmClear && <div className="mt-2 text-xs text-amber-300">This removes every saved review in this browser. Export anything you need first.<div className="mt-2 flex gap-2"><button onClick={clear} className={button}>Confirm clear archive</button><button onClick={() => setConfirmClear(false)} className={button}>Cancel clear</button></div></div>}</div>
  </section>;
}
