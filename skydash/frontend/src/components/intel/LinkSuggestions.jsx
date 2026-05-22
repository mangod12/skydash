import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, RefreshCw, Check, X } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';
import { useLinkSuggestions } from '../../hooks/useLinkSuggestions';

const SLIDE_OUT = { opacity: 0, x: 80, height: 0, marginBottom: 0 };
const VISIBLE = { opacity: 1, x: 0, height: 'auto', marginBottom: 8 };

export default function LinkSuggestions() {
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const addRelationship = useIntelStore((s) => s.addRelationship);

  const allSuggestions = useLinkSuggestions(entities, relationships);
  const [dismissed, setDismissed] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const pending = allSuggestions.filter((s) => !dismissed.has(s.id));

  const handleAccept = useCallback((sug) => {
    addRelationship({
      from: sug.fromEntity.id,
      to: sug.toEntity.id,
      type: sug.suggestedType,
      confidence: sug.confidence,
    });
    setDismissed((prev) => new Set([...prev, sug.id]));
  }, [addRelationship]);

  const handleDismiss = useCallback((sug) => {
    setDismissed((prev) => new Set([...prev, sug.id]));
  }, []);

  const handleRefresh = useCallback(() => {
    setDismissed(new Set());
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <GlassCard className="!p-3" animate={false}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 flex items-center gap-1.5">
          <Link2 size={10} className="text-indigo-400" />
          LINK SUGGESTIONS
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono tabular-nums text-zinc-600">
            {pending.length} pending
          </span>
          <button
            onClick={handleRefresh}
            className="text-zinc-600 hover:text-indigo-400 transition-colors"
            title="Refresh suggestions"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Suggestion list */}
      <div className="space-y-0" key={refreshKey}>
        <AnimatePresence mode="popLayout">
          {pending.map((sug) => (
            <motion.div
              key={sug.id}
              layout
              initial={VISIBLE}
              animate={VISIBLE}
              exit={SLIDE_OUT}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <SuggestionRow
                suggestion={sug}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {pending.length === 0 && (
          <div className="text-center text-zinc-700 text-[10px] tracking-wider py-4">
            NO PENDING SUGGESTIONS
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function SuggestionRow({ suggestion, onAccept, onDismiss }) {
  const { fromEntity, toEntity, suggestedType, reason, confidence } = suggestion;

  return (
    <div className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] mb-2 last:mb-0">
      {/* Entity pair */}
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 mb-1.5">
        <Link2 size={10} className="text-indigo-400 shrink-0" />
        <span className="truncate font-medium">{fromEntity.name}</span>
        <span className="text-zinc-600 text-[9px]">&harr;</span>
        <span className="truncate font-medium">{toEntity.name}</span>
      </div>

      {/* Reason */}
      <div className="text-[9px] text-zinc-500 mb-1 pl-4">
        Reason: <span className="font-mono text-zinc-400">{reason}</span>
      </div>

      {/* Type + confidence + actions */}
      <div className="flex items-center justify-between pl-4">
        <div className="text-[9px] text-zinc-500">
          Suggested:{' '}
          <span className="text-indigo-400 font-mono">
            {suggestedType.replace(/_/g, ' ')}
          </span>
          <span className="text-zinc-600 font-mono ml-1">({confidence}%)</span>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => onAccept(suggestion)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
          >
            <Check size={9} /> Accept
          </button>
          <button
            onClick={() => onDismiss(suggestion)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-zinc-600/15 text-zinc-500 hover:bg-zinc-600/30 transition-colors"
          >
            <X size={9} /> Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
