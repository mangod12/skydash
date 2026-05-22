import { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Trash2, Download } from 'lucide-react';
import { useAuditStore } from '../../stores/auditStore';

const CATEGORIES = ['all', 'entity', 'mission', 'map', 'export', 'system'];

const ACTION_COLORS = {
  create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  update: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  link: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  unlink: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  export: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  annotate: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  view: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

function formatTime(iso) {
  try { return new Date(iso).toISOString().slice(11, 19) + 'Z'; }
  catch { return '---'; }
}

function entriesToCSV(entries) {
  const header = 'timestamp,action,category,detail,entityId,missionId';
  const rows = entries.map((e) =>
    [e.timestamp, e.action, e.category, `"${(e.detail || '').replace(/"/g, '""')}"`, e.entityId || '', e.missionId || ''].join(','),
  );
  return [header, ...rows].join('\n');
}

export default function AuditLog() {
  const entries = useAuditStore((s) => s.entries);
  const clearAll = useAuditStore((s) => s.clear);
  const [filter, setFilter] = useState('all');
  const [confirming, setConfirming] = useState(false);
  const listRef = useRef(null);

  const visible = filter === 'all' ? entries : entries.filter((e) => e.category === filter);

  // Auto-scroll to top on new entry
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [entries.length]);

  const handleExportCSV = useCallback(() => {
    const csv = entriesToCSV(visible);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skydash-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [visible]);

  const handleClear = useCallback(() => {
    if (!confirming) { setConfirming(true); return; }
    clearAll();
    setConfirming(false);
  }, [confirming, clearAll]);

  // Reset confirm after 3s
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div className="rounded-2xl border border-white/[0.08] border-t-white/[0.12] backdrop-blur-[16px] bg-[rgba(9,9,11,0.55)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 flex flex-col max-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">AUDIT LOG</h3>
        <div className="flex gap-1.5">
          <button onClick={handleExportCSV} className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-semibold tracking-wider border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
            <Download size={10} /> CSV
          </button>
          <button onClick={handleClear} className={clsx('flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold tracking-wider border transition-colors', confirming ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/[0.04] text-zinc-500 border-white/[0.06] hover:bg-white/[0.06]')}>
            <Trash2 size={10} /> {confirming ? 'CONFIRM' : 'CLEAR'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 shrink-0 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={clsx(
              'px-2 py-1 rounded text-[9px] font-semibold tracking-wider transition-colors',
              filter === cat
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                : 'bg-white/[0.03] text-zinc-600 border border-white/[0.04] hover:text-zinc-400',
            )}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10">
        {visible.length === 0 && (
          <div className="text-center text-zinc-700 text-[10px] tracking-wider py-8">NO AUDIT ENTRIES</div>
        )}
        {visible.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
            <span className="font-mono tabular-nums text-[10px] text-zinc-600 shrink-0 mt-px">{formatTime(entry.timestamp)}</span>
            <span className={clsx('px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border shrink-0 mt-px', ACTION_COLORS[entry.action] || ACTION_COLORS.view)}>
              {entry.action.toUpperCase()}
            </span>
            <span className="text-[9px] font-semibold tracking-[0.1em] text-zinc-600 shrink-0 mt-0.5 w-12">
              {entry.category.toUpperCase()}
            </span>
            <span className="text-[11px] text-zinc-400 truncate">{entry.detail}</span>
          </div>
        ))}
      </div>

      {/* Footer count */}
      <div className="mt-2 pt-2 border-t border-white/[0.04] text-[9px] text-zinc-600 font-mono tabular-nums shrink-0">
        {visible.length} / {entries.length} entries
      </div>
    </div>
  );
}
