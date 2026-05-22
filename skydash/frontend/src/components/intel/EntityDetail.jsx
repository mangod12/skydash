import { clsx } from 'clsx';
import { X, MapPin, Link2, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';

const THREAT_LABELS = {
  none: { text: 'NONE', color: 'text-zinc-400 bg-zinc-800' },
  low: { text: 'LOW', color: 'text-emerald-400 bg-emerald-500/15' },
  medium: { text: 'MEDIUM', color: 'text-amber-400 bg-amber-500/15' },
  high: { text: 'HIGH', color: 'text-red-400 bg-red-500/15' },
  critical: { text: 'CRITICAL', color: 'text-red-400 bg-red-500/20 animate-pulse' },
};

export default function EntityDetail() {
  const entity = useIntelStore((s) => s.getSelectedEntity());
  const clearSelection = useIntelStore((s) => s.clearSelection);
  const relationships = useIntelStore((s) =>
    entity ? s.getEntityRelationships(entity.id) : []
  );
  const events = useIntelStore((s) =>
    entity ? s.getEntityEvents(entity.id) : []
  );
  const entities = useIntelStore((s) => s.entities);

  if (!entity) return null;

  const threat = THREAT_LABELS[entity.threatLevel] || THREAT_LABELS.none;

  const getEntityName = (id) => entities.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="h-full flex flex-col bg-[var(--surface-0)] border-l border-white/[0.06]">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-start justify-between shrink-0">
        <div>
          <div className="text-sm font-semibold text-zinc-200">{entity.name}</div>
          <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
            {entity.type} &middot; {entity.source}
          </div>
        </div>
        <button
          onClick={clearSelection}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Threat + Confidence */}
        <div className="flex gap-2">
          <div className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider', threat.color)}>
            THREAT: {threat.text}
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider text-cyan-400 bg-cyan-500/10">
            CONF: {entity.confidence}%
          </div>
        </div>

        {/* Confidence bar */}
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all duration-500"
            style={{ width: `${entity.confidence}%` }}
          />
        </div>

        {/* Properties */}
        <GlassCard className="!p-3" animate={false}>
          <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">PROPERTIES</h4>
          <div className="space-y-1.5">
            {Object.entries(entity.properties).map(([key, value]) => (
              <div key={key} className="flex justify-between items-baseline">
                <span className="text-[10px] text-zinc-500 uppercase">{key}</span>
                <span className="text-[11px] font-mono text-zinc-300">{String(value)}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Location */}
        {entity.coordinates && (
          <GlassCard className="!p-3" animate={false}>
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
              <MapPin size={10} /> LOCATION
            </h4>
            <div className="text-[11px] font-mono tabular-nums text-zinc-300">
              {entity.coordinates[0].toFixed(6)}, {entity.coordinates[1].toFixed(6)}
            </div>
          </GlassCard>
        )}

        {/* Relationships */}
        {relationships.length > 0 && (
          <GlassCard className="!p-3" animate={false}>
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
              <Link2 size={10} /> RELATIONSHIPS ({relationships.length})
            </h4>
            <div className="space-y-1.5">
              {relationships.map((rel, i) => {
                const otherId = rel.from === entity.id ? rel.to : rel.from;
                return (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">{getEntityName(otherId)}</span>
                    <span className="text-zinc-600 font-mono">{rel.type.replace(/_/g, ' ')}</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Events */}
        {events.length > 0 && (
          <GlassCard className="!p-3" animate={false}>
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
              <Clock size={10} /> ACTIVITY ({events.length})
            </h4>
            <div className="space-y-2">
              {events.slice(0, 5).map((evt) => (
                <div key={evt.id} className="text-[10px] border-l-2 border-white/[0.06] pl-2.5">
                  <div className="text-zinc-400">{evt.description}</div>
                  <div className="text-zinc-600 font-mono mt-0.5">
                    {formatDistanceToNow(evt.time, { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Timestamps */}
        <div className="text-[9px] text-zinc-600 space-y-1 px-1">
          <div>First seen: {format(entity.firstSeen, 'yyyy-MM-dd HH:mm')}</div>
          <div>Last seen: {formatDistanceToNow(entity.lastSeen, { addSuffix: true })}</div>
        </div>
      </div>
    </div>
  );
}
