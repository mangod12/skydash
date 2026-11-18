import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, Download, RefreshCw } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { apiFetch } from '../../utils/api';
import { API_BASE, API_CONFIGURED } from '../../utils/runtimeConfig';
import { assessMissionReadiness, formatReadinessReport, READINESS_SCOPE } from '../../utils/missionReadiness';

const styles = {
  pass: { icon: CheckCircle2, color: 'text-emerald-300', border: 'border-emerald-500/20' },
  warn: { icon: AlertTriangle, color: 'text-amber-300', border: 'border-amber-500/20' },
  unknown: { icon: HelpCircle, color: 'text-zinc-300', border: 'border-white/10' },
};

export default function MissionReadinessTab({ mission }) {
  const entities = useIntelStore(s => s.entities);
  const data = useTelemetryStore(s => s.data);
  const dataReceivedAt = useTelemetryStore(s => s.dataReceivedAt);
  const isConnected = useTelemetryStore(s => s.isConnected);
  const activeDroneId = useTelemetryStore(s => s.activeDroneId);
  const [now, setNow] = useState(Date.now);
  const [connectors, setConnectors] = useState({ state: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [captured, setCaptured] = useState(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const unsubscribe = useTelemetryStore.subscribe((state, previous) => {
      if (state.dataReceivedAt !== previous.dataReceivedAt) setNow(Date.now());
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    const timer = setTimeout(() => {
      controller.abort();
      if (live) setConnectors({ state: 'error' });
    }, 8000);
    async function load() {
      try {
        if (!API_CONFIGURED) throw new Error('API not configured');
        const response = await apiFetch(`${API_BASE}/api/connectors/status`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok || body?.success !== true || !body.data) throw new Error('Status unavailable');
        if (live && !controller.signal.aborted) {
          const checkedAt = Date.now();
          setNow(checkedAt);
          setConnectors({ state: 'loaded', data: body.data, checkedAt });
        }
      } catch {
        if (live) setConnectors({ state: 'error' });
      } finally {
        clearTimeout(timer);
      }
    }
    load();
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [refresh]);

  const report = assessMissionReadiness({ mission, entities, telemetry: { data, dataReceivedAt, isConnected, activeDroneId }, connectors, now });
  const download = () => {
    // Capture from the current evidence, not the last one-second render tick.
    const snapshot = assessMissionReadiness({ mission, entities, telemetry: { data, dataReceivedAt, isConnected, activeDroneId }, connectors, now: Date.now() });
    let url;
    try {
      url = URL.createObjectURL(new Blob([formatReadinessReport(snapshot)], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `skydash-readiness-${snapshot.assessedAt}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setCaptured(snapshot);
      setSaveError('');
      // Keep the blob alive until the browser has accepted the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setSaveError('Report download could not start. Try again in a browser that allows downloads.');
    }
  };

  return (
    <section aria-label="Mission readiness check" className="max-w-4xl space-y-4">
      <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-indigo-300">SIMULATION / TRAINING</p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-100">Mission Readiness Check</h3>
            <p className="mt-1 text-sm text-zinc-300">{report.result}</p>
          </div>
          <div className="flex gap-2 text-xs font-mono">
            {Object.entries(report.counts).map(([state, count]) => <span key={state} className={`rounded-lg border px-2 py-1 ${styles[state].border} ${styles[state].color}`}>{count} {state}</span>)}
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{READINESS_SCOPE}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setConnectors({ state: 'loading' }); setRefresh(value => value + 1); setNow(Date.now()); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5"><RefreshCw size={14} /> Refresh source status</button>
        <button onClick={download} className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-500/25"><Download size={14} /> Save timestamped report</button>
        <span className="text-[11px] text-zinc-500">Checks update each second. No commands are sent.</span>
      </div>
      {connectors.state === 'loading' && <p role="status" className="text-xs text-zinc-400">Checking connector configuration...</p>}
      {saveError && <p role="alert" className="text-xs text-amber-300">{saveError}</p>}
      {captured && <p role="status" className="rounded-lg border border-white/10 p-3 text-xs text-zinc-400">Report download requested at {new Date(captured.assessedAt).toISOString()}. This saved snapshot does not update. Re-run after changes. Reports are saved by your browser, not shared with the team.</p>}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {report.checks.map(check => {
          const { icon: Icon, color, border } = styles[check.state];
          return <article key={check.id} className={`rounded-xl border bg-zinc-900/50 p-4 ${border}`}>
            <div className="flex items-center gap-2"><Icon aria-hidden="true" size={16} className={color} /><h4 className="text-sm font-medium text-zinc-100">{check.label}</h4><span className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${color}`}>{check.state}</span></div>
            <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">{check.evidence}</p>
            {check.state !== 'pass' && <p className="mt-2 text-xs leading-relaxed text-zinc-300">Next: {check.action}</p>}
          </article>;
        })}
      </div>
      <p className="text-[11px] text-zinc-500">Selected drone: {report.droneId || 'unknown'}. Telemetry freshness means received by this browser, not independently verified sensor age. Connector checks expire after 60s.</p>
    </section>
  );
}
