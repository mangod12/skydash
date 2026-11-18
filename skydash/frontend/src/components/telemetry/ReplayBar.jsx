import { useState, useEffect, useCallback, useRef } from 'react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { apiFetch } from '../../utils/api';
import { API_BASE, API_CONFIGURED } from '../../utils/runtimeConfig';
import { normalizeFrames, clampIndex, nextIndex, formatOffset } from '../../utils/replay';

export default function ReplayBar() {
  const activeDroneId = useTelemetryStore((s) => s.activeDroneId);
  return <ReplaySession key={activeDroneId || 'no-drone'} activeDroneId={activeDroneId} />;
}

function ReplaySession({ activeDroneId }) {
  const requestRef = useRef(null);
  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  const [frames, setFrames] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!API_CONFIGURED || !activeDroneId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const current = () => requestRef.current === controller && !controller.signal.aborted;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(
        `${API_BASE}/api/telemetry/history?drone_id=${encodeURIComponent(activeDroneId)}&limit=300`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!current()) return;
      const next = normalizeFrames(json.data);
      setFrames(next);
      setIndex(Math.max(next.length - 1, 0));
      setPlaying(false);
    } catch {
      if (current()) setError('Could not load history');
    } finally {
      if (current()) {
        setLoading(false);
        requestRef.current = null;
      }
    }
  }, [activeDroneId]);

  useEffect(() => {
    if (!playing || frames.length === 0) return undefined;
    const id = setInterval(() => setIndex((i) => nextIndex(i, frames.length)), 500);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const frame = frames[clampIndex(index, frames.length)];
  const fmt = (v, digits = 1) => (v == null ? '--' : Number(v).toFixed(digits));

  return (
    <section
      aria-label="Telemetry replay"
      className="rounded-lg border border-white/[0.06] bg-[var(--surface-0)] p-3 text-[11px] font-mono"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 uppercase tracking-wider">Replay</span>
        <button
          type="button"
          onClick={load}
          disabled={loading || !activeDroneId}
          className="text-cyan-400 hover:text-cyan-300 disabled:text-zinc-600"
        >
          {loading ? 'Loading...' : frames.length ? 'Reload' : 'Load last 5 min'}
        </button>
      </div>
      {error && <p className="text-red-400 mb-2">{error}</p>}
      {frames.length === 0 ? (
        <p className="text-zinc-600">No history loaded</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="px-2 py-0.5 rounded bg-white/[0.06] text-zinc-200"
              aria-label={playing ? 'Pause replay' : 'Play replay'}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={clampIndex(index, frames.length)}
              onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
              className="flex-1"
              aria-label="Replay position"
            />
            <span className="w-12 text-right text-zinc-400 tabular-nums">{formatOffset(frames, index)}</span>
          </div>
          <dl className="grid grid-cols-4 gap-2 mt-2 text-zinc-300 tabular-nums">
            <div><dt className="text-zinc-600">ALT</dt><dd>{fmt(frame?.altitude)} m</dd></div>
            <div><dt className="text-zinc-600">SPD</dt><dd>{fmt(frame?.speed)} m/s</dd></div>
            <div><dt className="text-zinc-600">BATT</dt><dd>{fmt(frame?.battery, 2)} V</dd></div>
            <div><dt className="text-zinc-600">SIG</dt><dd>{fmt(frame?.signal, 0)}%</dd></div>
          </dl>
        </>
      )}
    </section>
  );
}
