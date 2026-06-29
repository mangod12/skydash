import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { DatabaseZap, DownloadCloud, Plane, Search, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useIntelStore } from '../../stores/intelStore';
import { toast } from '../common/Toast';

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8001');

const SOURCES = [
  { id: 'shodan', label: 'SHODAN IOT', icon: Search, description: 'Internet-exposed devices near the area of interest' },
  { id: 'adsb', label: 'ADS-B', icon: Plane, description: 'Aircraft tracks from OpenSky within the operating box' },
];

function buildUrl(source, query, dryRun) {
  const params = new URLSearchParams();
  params.set('dry_run', dryRun ? 'true' : 'false');
  if (source === 'shodan') {
    params.set('query', query.trim() || 'webcam');
    params.set('limit', '5');
  }
  return `${API}/api/connectors/${source}/ingest?${params.toString()}`;
}

function CandidateRow({ entity }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-white/[0.05] bg-white/[0.025] px-2 py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold tracking-wider text-zinc-300">
          {entity.name}
        </div>
        <div className="truncate text-[9px] font-mono text-zinc-600">
          {entity.type} / {entity.source}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] font-mono text-cyan-400">{entity.confidence}%</div>
        <div className="text-[8px] tracking-wider text-zinc-600 uppercase">{entity.threatLevel}</div>
      </div>
    </div>
  );
}

export default function OsintIngestPanel() {
  const fetchIntel = useIntelStore((s) => s.fetchIntel);
  const [source, setSource] = useState('shodan');
  const [query, setQuery] = useState('webcam');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState(null);

  const runIngest = useCallback(async (dryRun) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(buildUrl(source, query, dryRun), { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail || json.error || 'OSINT ingest failed');
      }
      setPreview(json.data || []);
      setMetadata(json.metadata || null);
      if (!dryRun) {
        await fetchIntel();
        const created = json.metadata?.created ?? 0;
        const updated = json.metadata?.updated ?? 0;
        toast(`OSINT import complete: ${created} created, ${updated} updated`, 'success');
      }
    } catch (err) {
      const message = err.message || 'OSINT source unavailable';
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchIntel, query, source]);

  const activeSource = SOURCES.find((item) => item.id === source) || SOURCES[0];
  const ActiveIcon = activeSource.icon;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DatabaseZap size={12} className="text-cyan-400" />
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            OSINT INGEST
          </span>
        </div>
        {metadata && (
          <span className="text-[9px] font-mono text-zinc-600">
            {metadata.mode?.toUpperCase()} / {metadata.count ?? 0}
          </span>
        )}
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {SOURCES.map((item) => {
          const Icon = item.icon;
          const active = item.id === source;
          return (
            <button
              key={item.id}
              onClick={() => { setSource(item.id); setPreview([]); setMetadata(null); setError(null); }}
              className={clsx(
                'flex items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[9px] font-semibold tracking-wider transition-colors',
                active
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/[0.06] text-zinc-600 hover:text-zinc-400',
              )}
            >
              <Icon size={10} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-center gap-2 rounded border border-white/[0.05] bg-white/[0.025] px-2 py-1.5">
        <ActiveIcon size={12} className="shrink-0 text-zinc-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-zinc-400">{activeSource.description}</div>
          {source === 'shodan' && (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full bg-transparent text-[10px] font-mono text-zinc-300 outline-none placeholder:text-zinc-700"
              placeholder="webcam, scada, rtsp..."
            />
          )}
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => runIngest(true)}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 rounded bg-white/[0.04] px-2 py-1.5 text-[9px] font-semibold tracking-wider text-zinc-400 transition-colors hover:bg-white/[0.07] disabled:opacity-40"
        >
          <ShieldCheck size={10} />
          PREVIEW
        </button>
        <button
          onClick={() => runIngest(false)}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 rounded bg-cyan-600/80 px-2 py-1.5 text-[9px] font-semibold tracking-wider text-white transition-colors hover:bg-cyan-500 disabled:opacity-40"
        >
          <DownloadCloud size={10} />
          IMPORT
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
          {error}
        </div>
      )}

      <div className="max-h-28 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
        {preview.slice(0, 5).map((entity) => (
          <CandidateRow key={entity.id} entity={entity} />
        ))}
        {!loading && preview.length === 0 && (
          <div className="py-2 text-center text-[10px] tracking-wider text-zinc-700">
            PREVIEW A SOURCE BEFORE IMPORT
          </div>
        )}
        {loading && (
          <div className="py-2 text-center text-[10px] tracking-wider text-cyan-500">
            QUERYING SOURCE...
          </div>
        )}
      </div>
    </div>
  );
}
