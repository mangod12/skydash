import { useMemo } from 'react';
import { clsx } from 'clsx';
import { X, ChevronDown } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';
import { distanceBetween } from '../../utils/coordinates';

const _THREAT_ORDER = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const THREAT_BAR = { none: 'w-1/5', low: 'w-2/5', medium: 'w-3/5', high: 'w-4/5', critical: 'w-full' };
const THREAT_COLOR = { none: 'bg-zinc-600', low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-red-500', critical: 'bg-red-600' };

function EntitySelector({ value, onChange, entities, label }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="text-[9px] font-semibold tracking-[0.15em] text-zinc-600 block mb-1">{label}</label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full appearance-none bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-[11px] text-zinc-300 outline-none focus:border-indigo-500/40 transition-colors cursor-pointer"
        >
          <option value="" className="bg-zinc-900">-- Select --</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id} className="bg-zinc-900">{e.name}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
      </div>
    </div>
  );
}

const DiffCell = ({ val, other, missing }) => {
  if (val == null || val === '') return <span className="text-[11px] font-mono text-zinc-600">&mdash;</span>;
  const same = String(val) === String(other);
  return (
    <span className={clsx('text-[11px] font-mono', same ? 'text-emerald-400' : missing ? 'text-zinc-600' : 'text-amber-400')}>
      {String(val)}
    </span>
  );
};

const SectionLabel = ({ children }) => (
  <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">{children}</h4>
);

function CommonElements({ a, b, relsA, relsB, entities }) {
  const sharedRels = useMemo(() => {
    const targetsA = new Set(relsA.map((r) => (r.from === a.id ? r.to : r.from)));
    const targetsB = new Set(relsB.map((r) => (r.from === b.id ? r.to : r.from)));
    return [...targetsA].filter((id) => targetsB.has(id));
  }, [a, b, relsA, relsB]);

  const sharedTags = useMemo(() => {
    const setA = new Set(a.tags || []);
    return (b.tags || []).filter((t) => setA.has(t));
  }, [a, b]);

  const distance = useMemo(() => {
    if (!a.coordinates || !b.coordinates) return null;
    return distanceBetween(a.coordinates[0], a.coordinates[1], b.coordinates[0], b.coordinates[1]);
  }, [a, b]);

  const getName = (id) => entities.find((e) => e.id === id)?.name ?? id;
  const sameType = a.type === b.type;
  const hasOverlap = a.firstSeen <= b.lastSeen && b.firstSeen <= a.lastSeen;
  const hasContent = sharedRels.length > 0 || sharedTags.length > 0 || distance != null || sameType;

  if (!hasContent) return null;

  return (
    <GlassCard className="!p-3 col-span-2" animate={false}>
      <SectionLabel>COMMON ELEMENTS</SectionLabel>
      <div className="space-y-1.5 text-[11px]">
        {sameType && <div className="text-emerald-400 font-mono">Same type: {a.type.toUpperCase()}</div>}
        {sharedRels.map((id) => (
          <div key={id} className="text-emerald-400 font-mono">Both connected to: {getName(id)}</div>
        ))}
        {sharedTags.map((tag) => (
          <div key={tag} className="text-emerald-400 font-mono">Both tagged: {tag}</div>
        ))}
        {distance != null && (
          <div className="text-cyan-400 font-mono">
            Proximity: {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`} apart
          </div>
        )}
        {hasOverlap && <div className="text-violet-400 font-mono">Temporal overlap confirmed</div>}
      </div>
    </GlassCard>
  );
}

export default function EntityComparison() {
  const entities = useIntelStore((s) => s.entities);
  const comparedEntities = useIntelStore((s) => s.comparedEntities);
  const setComparedEntity = useIntelStore((s) => s.setComparedEntity);
  const clearComparison = useIntelStore((s) => s.clearComparison);
  const getEntityRelationships = useIntelStore((s) => s.getEntityRelationships);

  const a = entities.find((e) => e.id === comparedEntities[0]) ?? null;
  const b = entities.find((e) => e.id === comparedEntities[1]) ?? null;
  const relsA = a ? getEntityRelationships(a.id) : [];
  const relsB = b ? getEntityRelationships(b.id) : [];
  const getName = (id) => entities.find((e) => e.id === id)?.name ?? id;

  const allPropKeys = [
    ...new Set([...Object.keys(a?.properties || {}), ...Object.keys(b?.properties || {})]),
  ];

  const renderColumn = (ent, rels, other) => {
    if (!ent) return <div className="flex-1 flex items-center justify-center text-zinc-700 text-[10px] tracking-wider">NO ENTITY SELECTED</div>;
    const sameType = other && ent.type === other.type;
    return (
      <div className="flex-1 min-w-0 space-y-3">
        {/* Header */}
        <GlassCard className="!p-3" animate={false}>
          <div className="text-sm font-semibold text-zinc-200 mb-1">{ent.name}</div>
          <div className={clsx('text-[10px] font-mono uppercase tracking-wider mb-2', sameType ? 'text-emerald-400' : 'text-zinc-400')}>
            {ent.type}
          </div>
          <div className="h-2 rounded-full bg-zinc-800 mb-1">
            <div className={clsx('h-full rounded-full transition-all', THREAT_BAR[ent.threatLevel], THREAT_COLOR[ent.threatLevel])} />
          </div>
          <div className="flex justify-between text-[10px]">
            <span className={clsx('font-mono uppercase', THREAT_COLOR[ent.threatLevel]?.replace('bg-', 'text-'))}>{ent.threatLevel}</span>
            <span className="font-mono text-zinc-400">{ent.confidence}% conf</span>
          </div>
        </GlassCard>

        {/* Properties */}
        <GlassCard className="!p-3" animate={false}>
          <SectionLabel>PROPERTIES</SectionLabel>
          <div className="space-y-1.5">
            {allPropKeys.map((key) => (
              <div key={key} className={clsx('flex justify-between items-baseline border-l-2 pl-2', ent.properties?.[key] != null && other?.properties?.[key] != null ? (String(ent.properties[key]) === String(other.properties[key]) ? 'border-emerald-500/50' : 'border-amber-500/50') : 'border-zinc-700/50')}>
                <span className="text-[10px] text-zinc-500 uppercase">{key}</span>
                <DiffCell val={ent.properties?.[key]} other={other?.properties?.[key]} missing={!other?.properties?.[key]} />
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Relationships */}
        <GlassCard className="!p-3" animate={false}>
          <SectionLabel>RELATIONSHIPS ({rels.length})</SectionLabel>
          <div className="space-y-1">
            {rels.length === 0 && <div className="text-[10px] text-zinc-700">None</div>}
            {rels.map((rel, i) => {
              const otherId = rel.from === ent.id ? rel.to : rel.from;
              const _otherRels = other ? (rel.from === ent.id ? relsA : relsB) : [];
              const otherTargets = new Set((other ? (ent === a ? relsB : relsA) : []).map((r) => (r.from === other?.id ? r.to : r.from)));
              const shared = otherTargets.has(otherId);
              return (
                <div key={i} className={clsx('text-[10px] flex items-center gap-1.5 border-l-2 pl-2', shared ? 'border-emerald-500/50 text-emerald-400' : 'border-zinc-700/50 text-zinc-400')}>
                  <span className="font-mono">{getName(otherId)}</span>
                  <span className="text-zinc-600 ml-auto">{rel.type.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Selectors */}
      <div className="flex gap-3 p-3 border-b border-white/[0.06] shrink-0 items-end">
        <EntitySelector label="SELECT ENTITY A" value={comparedEntities[0]} onChange={(id) => setComparedEntity(0, id)} entities={entities} />
        <EntitySelector label="SELECT ENTITY B" value={comparedEntities[1]} onChange={(id) => setComparedEntity(1, id)} entities={entities} />
        <button onClick={clearComparison} className="text-zinc-600 hover:text-zinc-400 transition-colors p-2 shrink-0" title="Close comparison">
          <X size={16} />
        </button>
      </div>

      {/* Comparison columns */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex">{renderColumn(a, relsA, b)}</div>
          <div className="flex">{renderColumn(b, relsB, a)}</div>
          {a && b && <CommonElements a={a} b={b} relsA={relsA} relsB={relsB} entities={entities} />}
        </div>
      </div>
    </div>
  );
}
