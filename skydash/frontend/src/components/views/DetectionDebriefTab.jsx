import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import {
  ScanSearch,
  Upload,
  Loader2,
  AlertTriangle,
  PlayCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { API_BASE } from '../../utils/runtimeConfig';
import { useMissionStore } from '../../stores/missionStore';

const API = API_BASE;

export default function DetectionDebriefTab({ mission }) {
  const {
    visionStatus,
    fetchVisionStatus,
    analyzeMissionImage,
    monitorSampleVideo,
    deleteDetection,
    addNote,
  } = useMissionStore();
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [monitoringSample, setMonitoringSample] = useState(false);
  const [showSampleFeed, setShowSampleFeed] = useState(true);
  const detections = mission.detections || [];
  const latestDetection = detections[0];
  const latestLabels = Object.entries(latestDetection?.summary?.labels || {})
    .map(([label, count]) => `${count} ${label}`)
    .join(' / ');

  useEffect(() => {
    fetchVisionStatus();
  }, [fetchVisionStatus]);

  const handleAnalyze = async () => {
    if (!file || !visionStatus?.available) {
      return;
    }

    setAnalyzing(true);
    try {
      await analyzeMissionImage(mission.id, file);
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSampleMonitor = async () => {
    if (!visionStatus?.available) {
      return;
    }

    setMonitoringSample(true);
    try {
      await monitorSampleVideo(mission.id);
    } finally {
      setMonitoringSample(false);
    }
  };

  const addDetectionNote = async (result) => {
    const labels = Object.entries(result.summary?.labels || {})
      .map(([label, count]) => `${count} ${label}`)
      .join(', ');
    await addNote(
      mission.id,
      `RT-DETR frame analysis (${result.source_name}): ${
        result.summary?.total || 0
      } object(s) detected${labels ? ` - ${labels}` : ''}.`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/[0.06] bg-zinc-950/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">RT-DETR MISSION FRAME ANALYSIS</h4>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              Upload a mission frame or drone still to detect vehicles, people,
              and other visible objects for the debrief.
            </p>
          </div>
          <span
            className={clsx(
              'shrink-0 text-[8px] font-bold tracking-wider px-2 py-1 rounded border',
              visionStatus?.available
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            )}
          >
            {visionStatus?.available ? 'READY' : 'OPTIONAL'}
          </span>
        </div>
        {!visionStatus?.available && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              Install backend vision extras to enable RT-DETR:{' '}
              <span className="font-mono">pip install -r requirements-vision.txt</span>
              {visionStatus?.error && (
                <div className="mt-1 text-amber-300/80">{visionStatus.error}</div>
              )}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold tracking-wider text-zinc-300 hover:bg-white/[0.06]">
            <Upload size={12} />
            {file ? file.name : 'SELECT FRAME'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={handleAnalyze}
            disabled={!file || !visionStatus?.available || analyzing}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-3 py-2 text-[10px] font-semibold tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
            ANALYZE
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-zinc-950/35 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">SAMPLE VIDEO MONITOR</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Live MJPEG feed with RT-DETR frame capture for this mission.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${API}/api/vision/sample-viewer`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold tracking-wider text-zinc-300 hover:bg-white/[0.06]"
              >
                <ExternalLink size={12} />
                OPEN FEED
              </a>
              <button
                onClick={() => setShowSampleFeed((value) => !value)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold tracking-wider text-zinc-300 hover:bg-white/[0.06]"
              >
                {showSampleFeed ? 'HIDE FEED' : 'SHOW FEED'}
              </button>
              <button
                onClick={handleSampleMonitor}
                disabled={!visionStatus?.available || monitoringSample}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[10px] font-semibold tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {monitoringSample ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                MONITOR SAMPLE
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
              <div className="text-[8px] tracking-wider text-zinc-600">FEED</div>
              <div className="mt-1 text-[10px] font-semibold text-emerald-300">
                {visionStatus?.available ? 'LIVE' : 'OFFLINE'}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
              <div className="text-[8px] tracking-wider text-zinc-600">MODEL</div>
              <div className="mt-1 truncate font-mono text-[10px] text-zinc-300">
                {visionStatus?.model || 'rtdetr-l.pt'}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
              <div className="text-[8px] tracking-wider text-zinc-600">LATEST</div>
              <div className="mt-1 truncate text-[10px] font-semibold text-zinc-300">
                {latestLabels || 'NO CAPTURE'}
              </div>
            </div>
          </div>
        </div>
        {showSampleFeed && (
          <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06] bg-black">
            {visionStatus?.available ? (
              <div className="relative">
                <img
                  src={`${API}/api/vision/sample-feed`}
                  alt="SkyDash RT-DETR sample monitoring feed"
                  className="aspect-video w-full object-cover"
                />
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded border border-emerald-400/30 bg-black/70 px-2 py-1 text-[9px] font-semibold tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.85)]" />
                  LIVE
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10">
                  <span className="truncate text-[10px] font-semibold tracking-wider text-zinc-300">
                    RT-DETR SAMPLE MONITOR
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-zinc-500">MJPEG</span>
                </div>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center text-[11px] tracking-wider text-zinc-600">
                INSTALL VISION EXTRAS TO ENABLE SAMPLE FEED
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            {detections.length} ANALYSIS RUNS
          </span>
          <span className="text-[9px] font-mono text-zinc-700">
            Model: {visionStatus?.model || 'rtdetr-l.pt'}
          </span>
        </div>
        {detections.map((result) => (
          <div key={result.id} className="rounded-lg border border-white/[0.06] bg-zinc-950/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-zinc-200">{result.source_name}</div>
                <div className="mt-1 text-[9px] font-mono text-zinc-600">
                  {result.model} | {result.created_at ? formatDistanceToNow(new Date(result.created_at), { addSuffix: true }) : 'recent'}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => addDetectionNote(result)}
                  className="rounded bg-indigo-500/15 px-2 py-1 text-[9px] font-semibold tracking-wider text-indigo-300 hover:bg-indigo-500/25"
                >
                  NOTE
                </button>
                <button
                  onClick={() => deleteDetection(mission.id, result.id)}
                  className="rounded bg-red-500/10 p-1 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.04] bg-zinc-950/40 p-2">
                <div className="text-[8px] tracking-wider text-zinc-600">OBJECTS</div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">{result.summary?.total || 0}</div>
              </div>
              {Object.entries(result.summary?.labels || {}).slice(0, 3).map(([label, count]) => (
                <div key={label} className="rounded-lg border border-white/[0.04] bg-zinc-950/40 p-2">
                  <div className="truncate text-[8px] uppercase tracking-wider text-zinc-600">{label}</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-100">{count}</div>
                </div>
              ))}
            </div>
            {result.detections?.length > 0 && (
              <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-white/[0.04] bg-zinc-950/30">
                {result.detections.slice(0, 12).map((detection, index) => (
                  <div
                    key={`${result.id}-${index}`}
                    className="flex items-center justify-between border-b border-white/[0.04] px-3 py-1.5 last:border-b-0"
                  >
                    <span className="text-[10px] text-zinc-300">{detection.label}</span>
                    <span className="font-mono text-[9px] text-zinc-500">
                      {Math.round((detection.confidence || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {detections.length === 0 && (
          <div className="text-center text-[10px] tracking-wider text-zinc-700 py-6">
            NO FRAME ANALYSIS YET
          </div>
        )}
      </div>
    </div>
  );
}
