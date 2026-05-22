import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Radar, Clock, GitBranch, AlertTriangle, Unlink, Route,
  ChevronDown, RefreshCw, MapPin, Search,
} from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { useEntityNavigation } from '../../hooks/useEntityNavigation';
import {
  detectSpatialClusters, detectTemporalBursts, detectCorridors,
  detectHubs, detectIsolated, detectThreatEscalation,
} from '../../utils/patternDetector';

const SECTION_CONFIG = [
  { key: 'clusters', label: 'SPATIAL CLUSTERS', icon: Radar, color: 'cyan' },
  { key: 'hubs', label: 'HUB ENTITIES', icon: GitBranch, color: 'indigo' },
  { key: 'bursts', label: 'TEMPORAL BURSTS', icon: Clock, color: 'amber' },
  { key: 'threats', label: 'THREAT ESCALATION', icon: AlertTriangle, color: 'red' },
  { key: 'isolated', label: 'ISOLATED ENTITIES', icon: Unlink, color: 'zinc' },
  { key: 'corridors', label: 'CORRIDORS', icon: Route, color: 'violet' },
];

const COLOR_MAP = { cyan: 'text-cyan-400', indigo: 'text-indigo-400', amber: 'text-amber-400', red: 'text-red-400', zinc: 'text-zinc-400', violet: 'text-violet-400' };
const BG_MAP = { cyan: 'bg-cyan-500/5 border-cyan-500/20', indigo: 'bg-indigo-500/5 border-indigo-500/20', amber: 'bg-amber-500/5 border-amber-500/20', red: 'bg-red-500/5 border-red-500/20', zinc: 'bg-zinc-500/5 border-zinc-500/20', violet: 'bg-violet-500/5 border-violet-500/20' };

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

export default function PatternPanel() {
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const { flyToCoordinates } = useEntityNavigation();
  const [expanded, setExpanded] = useState({ clusters: true, hubs: true, bursts: false, threats: true, isolated: false, corridors: false });
  const [refreshKey, setRefreshKey] = useState(0);

  const patterns = useMemo(() => ({
    clusters: detectSpatialClusters(entities),
    bursts: detectTemporalBursts(events),
    corridors: detectCorridors(entities, relationships),
    hubs: detectHubs(entities, relationships),
    isolated: detectIsolated(entities, relationships),
    threats: detectThreatEscalation(entities, events),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [entities, relationships, events, refreshKey]);

  const toggle = useCallback((key) => setExpanded((p) => ({ ...p, [key]: !p[key] })), []);
  const counts = useMemo(() => Object.fromEntries(Object.entries(patterns).map(([k, v]) => [k, v.length])), [patterns]);

  const investigate = useCallback((ids) => { if (ids[0]) selectEntity(ids[0]); }, [selectEntity]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold tracking-[0.15em] text-zinc-400">PATTERN DETECTION</h3>
        <button onClick={() => setRefreshKey((k) => k + 1)} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      {SECTION_CONFIG.map(({ key, label, icon: Icon, color }) => (
        <div key={key} className={clsx('rounded-xl border', BG_MAP[color])}>
          <button onClick={() => toggle(key)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
            <Icon size={12} className={COLOR_MAP[color]} />
            <span className="text-[10px] font-bold tracking-[0.12em] text-zinc-300 flex-1">{label}</span>
            <span className="font-mono text-[10px] text-zinc-500">{counts[key]} found</span>
            <ChevronDown size={10} className={clsx('text-zinc-600 transition-transform', expanded[key] && 'rotate-180')} />
          </button>

          <AnimatePresence initial={false}>
            {expanded[key] && counts[key] > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2">
                  {key === 'clusters' && patterns.clusters.map((c, i) => (
                    <PatternCard key={i} color={color} title={`Cluster ${String.fromCharCode(65 + i)}: ${c.entities.length} entities`} desc={c.entities.map((e) => e.name).join(', ')} meta={`Radius: ${c.radius}m`}
                      onMap={() => flyToCoordinates(c.centroid)} onInvestigate={() => investigate(c.entities.map((e) => e.id))} />
                  ))}
                  {key === 'hubs' && patterns.hubs.map((h, i) => (
                    <PatternCard key={i} color={color} title={`${h.entity.name} (${h.degree} connections)`} desc={h.connections.join(', ')} meta="Central node in entity network"
                      onMap={() => h.entity.coordinates && flyToCoordinates(h.entity.coordinates)} onInvestigate={() => selectEntity(h.entity.id)} />
                  ))}
                  {key === 'bursts' && patterns.bursts.map((b, i) => (
                    <PatternCard key={i} color={color} title={`${formatTime(b.start)}–${formatTime(b.end)}: ${b.count} events`} desc={b.events.slice(0, 2).map((e) => e.description).join('; ')} meta="Activity spike detected"
                      onInvestigate={() => investigate(b.events.map((e) => e.entityId).filter(Boolean))} />
                  ))}
                  {key === 'threats' && patterns.threats.map((t, i) => (
                    <PatternCard key={i} color={color} title={`${t.entity.name} — ${t.risk.toUpperCase()}`} desc={`${t.recentEvents.length} recent events`} meta={`Threat: ${t.entity.threatLevel}`}
                      onMap={() => t.entity.coordinates && flyToCoordinates(t.entity.coordinates)} onInvestigate={() => selectEntity(t.entity.id)} />
                  ))}
                  {key === 'isolated' && patterns.isolated.map((e) => (
                    <PatternCard key={e.id} color={color} title={e.name} desc={`${e.type} — no relationships detected`} meta={`Confidence: ${e.confidence}%`}
                      onMap={() => e.coordinates && flyToCoordinates(e.coordinates)} onInvestigate={() => selectEntity(e.id)} />
                  ))}
                  {key === 'corridors' && patterns.corridors.map((c, i) => (
                    <PatternCard key={i} color={color} title={`Corridor ${i + 1}`} desc={c.name} meta={`${c.path.length} waypoints`}
                      onInvestigate={() => investigate(c.path)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function PatternCard({ color, title, desc, meta, onMap, onInvestigate }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/[0.04] p-2.5 space-y-1.5">
      <p className="text-[11px] font-semibold text-zinc-200 leading-tight">{title}</p>
      <p className="text-[10px] text-zinc-500 leading-snug line-clamp-2">{desc}</p>
      {meta && <p className="font-mono text-[9px] text-zinc-600">{meta}</p>}
      <div className="flex gap-2 pt-1">
        {onMap && (
          <button onClick={onMap} className={clsx('flex items-center gap-1 text-[9px] font-semibold tracking-wider', COLOR_MAP[color], 'hover:brightness-125 transition')}>
            <MapPin size={9} /> VIEW ON MAP
          </button>
        )}
        {onInvestigate && (
          <button onClick={onInvestigate} className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-zinc-500 hover:text-zinc-300 transition">
            <Search size={9} /> INVESTIGATE
          </button>
        )}
      </div>
    </div>
  );
}
