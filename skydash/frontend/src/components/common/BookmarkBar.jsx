import { useState, useRef, useEffect } from 'react';
import { Star, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useBookmarkStore } from '../../stores/bookmarkStore';

const CHIP_BASE = 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider cursor-pointer transition-all duration-150 select-none';
const ACTIVE_CHIP = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
const IDLE_CHIP = 'text-zinc-500 border border-white/[0.04] hover:bg-white/[0.04]';

function CtxMenu({ x, y, onRename, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const btn = (click, cls, icon, label) => (
    <button onClick={click} className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] ${cls}`}>{icon} {label}</button>
  );
  return (
    <div ref={ref} style={{ left: x, top: y }} className="fixed z-50 bg-zinc-900/95 border border-white/[0.1] rounded-lg shadow-xl py-1 min-w-[120px] backdrop-blur-xl">
      {btn(onRename, 'text-zinc-400 hover:bg-white/[0.04]', <Pencil size={10} />, 'RENAME')}
      {btn(onDelete, 'text-red-400 hover:bg-red-500/10', <Trash2 size={10} />, 'DELETE')}
    </div>
  );
}

export default function BookmarkBar({ type, onApply }) {
  const { bookmarks, activeBookmarkId, addBookmark: _addBookmark, removeBookmark, renameBookmark, setActive } = useBookmarkStore();
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [ctx, setCtx] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const inputRef = useRef(null);
  const renameRef = useRef(null);

  const visible = type ? bookmarks.filter((b) => b.type === type) : bookmarks;

  useEffect(() => { if (saving && inputRef.current) inputRef.current.focus(); }, [saving]);
  useEffect(() => { if (renaming && renameRef.current) renameRef.current.focus(); }, [renaming]);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    onApply?.('save', name);
    setSaving(false); setSaveName('');
  };
  const handleApply = (bk) => { setActive(bk.id); onApply?.('apply', bk); };
  const handleCtx = (e, bk) => { e.preventDefault(); setCtx({ id: bk.id, x: e.clientX, y: e.clientY }); };
  const startRename = () => {
    setRenaming(ctx.id); setRenameVal(bookmarks.find((b) => b.id === ctx.id)?.name || ''); setCtx(null);
  };
  const commitRename = () => { if (renameVal.trim()) renameBookmark(renaming, renameVal.trim()); setRenaming(null); };

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none">
      <span className="text-[8px] font-semibold tracking-[0.15em] text-zinc-600 uppercase shrink-0 mr-0.5">
        BOOKMARKS
      </span>

      {visible.map((bk) => (
        renaming === bk.id ? (
          <input
            key={bk.id}
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
            className="bg-white/[0.04] border border-indigo-500/30 rounded-full px-2.5 py-1 text-[10px] text-indigo-400 outline-none w-28"
          />
        ) : (
          <button
            key={bk.id}
            onClick={() => handleApply(bk)}
            onContextMenu={(e) => handleCtx(e, bk)}
            className={clsx(CHIP_BASE, activeBookmarkId === bk.id ? ACTIVE_CHIP : IDLE_CHIP)}
          >
            <Star size={10} className={activeBookmarkId === bk.id ? 'fill-indigo-400' : ''} />
            {bk.name.toUpperCase()}
          </button>
        )
      ))}

      {saving ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={inputRef}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false); }}
            placeholder="Bookmark name..."
            className="bg-white/[0.04] border border-white/[0.08] rounded-full px-2.5 py-1 text-[10px] text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/30 w-32"
          />
          <button onClick={handleSave} className={clsx(CHIP_BASE, ACTIVE_CHIP, 'px-2')}>SAVE</button>
          <button onClick={() => setSaving(false)} className="text-zinc-600 hover:text-zinc-400"><X size={12} /></button>
        </div>
      ) : (
        <button onClick={() => setSaving(true)} className={clsx(CHIP_BASE, IDLE_CHIP, 'shrink-0')}>
          <Plus size={10} /> SAVE CURRENT
        </button>
      )}

      {ctx && (
        <CtxMenu x={ctx.x} y={ctx.y} onRename={startRename}
          onDelete={() => { removeBookmark(ctx.id); setCtx(null); }} onClose={() => setCtx(null)} />
      )}
    </div>
  );
}
