import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import GlassCard from '../common/GlassCard';
import { useProvenanceStore } from '../../stores/provenanceStore';

const ACTION_STYLE = {
  created:    { dot: 'bg-emerald-400', ring: 'ring-emerald-400/40', text: 'text-emerald-400' },
  updated:    { dot: 'bg-amber-400',   ring: 'ring-amber-400/40',   text: 'text-amber-400' },
  confirmed:  { dot: 'bg-cyan-400',    ring: 'ring-cyan-400/40',    text: 'text-cyan-400' },
  disputed:   { dot: 'bg-red-500',     ring: 'ring-red-500/40',     text: 'text-red-500' },
  classified: { dot: 'bg-violet-400',  ring: 'ring-violet-400/40',  text: 'text-violet-400' },
  sourced:    { dot: 'bg-indigo-400',  ring: 'ring-indigo-400/40',  text: 'text-indigo-400' },
};
const FALLBACK_STYLE = { dot: 'bg-zinc-500', ring: 'ring-zinc-500/40', text: 'text-zinc-400' };

const ACTOR_STYLES = {
  sensor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',  analyst: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  osint: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',  system: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

function ActorBadge({ actor }) {
  return (
    <span className={clsx(
      'px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] uppercase rounded border',
      ACTOR_STYLES[actor] || ACTOR_STYLES.system,
    )}>
      {actor}
    </span>
  );
}

function ConfidenceBar({ confidence, sourceCount, lastVerified }) {
  const pct = Math.min(100, Math.max(0, confidence));
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06]">
      <h5 className="text-[9px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">CONFIDENCE DERIVATION</h5>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-zinc-500 uppercase">Source credibility</span>
          <span className="text-[10px] font-mono tabular-nums text-zinc-300">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[9px] text-zinc-500">
          <span>Corroboration: <span className="text-zinc-300 font-mono">{sourceCount} sources</span></span>
          {lastVerified && <span>Verified: <span className="font-mono text-zinc-400">{format(new Date(lastVerified), 'HH:mm')}Z</span></span>}
        </div>
      </div>
    </div>
  );
}

export default function EvidenceChain({ entityId, confidence, defaultExpanded = false }) {
  if (!entityId) return null;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const provenanceEntries = useProvenanceStore((s) => s.entries);

  const chain = useMemo(() => {
    return provenanceEntries
      .filter((entry) => entry.entityId === entityId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [provenanceEntries, entityId]);

  const sourceCount = useMemo(() => {
    return new Set(chain.map((entry) => entry.actor)).size;
  }, [chain]);

  const lastVerified = useMemo(() => {
    const confirmed = chain.filter((entry) => entry.action === 'confirmed');
    if (confirmed.length === 0) return null;
    const latest = confirmed.reduce((acc, entry) => {
      const t = new Date(entry.timestamp).getTime();
      return t > acc.time ? { entry, time: t } : acc;
    }, { entry: confirmed[0], time: new Date(confirmed[0].timestamp).getTime() });
    return latest.entry.timestamp;
  }, [chain]);

  if (chain.length === 0) return null;

  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="border-t border-white/[0.06] pt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.15em] text-zinc-500 hover:text-zinc-400 transition-colors mb-2"
      >
        <Shield size={10} />
        EVIDENCE CHAIN ({chain.length})
        <Icon size={12} className="ml-auto" />
      </button>

      {expanded && (
        <GlassCard className="!p-3" animate={false}>
          <div className="relative pl-4">
            {/* Vertical connector line */}
            <div className="absolute left-[5px] top-1 bottom-4 w-px bg-white/[0.08]" />

            <div className="space-y-3">
              {chain.map((entry) => (
                <div key={entry.id} className="relative flex items-start gap-2.5">
                  {/* Dot */}
                  <div className={clsx(
                    'absolute -left-4 top-0.5 w-2.5 h-2.5 rounded-full ring-2 shrink-0',
                    (ACTION_STYLE[entry.action] || FALLBACK_STYLE).dot,
                    (ACTION_STYLE[entry.action] || FALLBACK_STYLE).ring,
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono tabular-nums text-zinc-500">
                        {format(new Date(entry.timestamp), 'HH:mm')}Z
                      </span>
                      <span className={clsx(
                        'text-[9px] font-bold tracking-[0.12em] uppercase',
                        (ACTION_STYLE[entry.action] || FALLBACK_STYLE).text,
                      )}>
                        {entry.action}
                      </span>
                      <ActorBadge actor={entry.actor} />
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                      {entry.detail}
                    </p>
                  </div>
                </div>
              ))}

              {/* Current state marker */}
              <div className="relative flex items-center gap-2.5">
                <div className="absolute -left-4 top-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-600 bg-transparent" />
                <span className="text-[9px] text-zinc-600 italic">current state</span>
              </div>
            </div>
          </div>

          <ConfidenceBar
            confidence={confidence}
            sourceCount={sourceCount}
            lastVerified={lastVerified}
          />
        </GlassCard>
      )}
    </div>
  );
}
