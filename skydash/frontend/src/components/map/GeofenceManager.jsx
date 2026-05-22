import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useMapStore } from '../../stores/mapStore';
import { toast } from '../common/Toast';

const ZONE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'];

function formatSize(fence) {
  if (fence.type === 'circle') {
    return fence.radius >= 1000 ? `${(fence.radius / 1000).toFixed(1)}km radius` : `${fence.radius}m radius`;
  }
  return `${fence.points?.length || 0} vertices`;
}

function ToggleSwitch({ on, onChange, size = 'sm' }) {
  const w = size === 'sm' ? 'w-7 h-3.5' : 'w-8 h-4';
  const dot = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <button onClick={onChange} className={clsx('rounded-full relative transition-colors', w, on ? 'bg-indigo-500' : 'bg-zinc-700')}>
      <div className={clsx('absolute top-0.5 rounded-full bg-white transition-all', dot, on ? 'left-[14px]' : 'left-0.5')} />
    </button>
  );
}

function GeofenceCard({ fence, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fence.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onUpdate(fence.id, { name });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(fence.id);
    toast(`${fence.name} deleted`, 'info');
  };

  useEffect(() => { if (confirmDelete) { const t = setTimeout(() => setConfirmDelete(false), 3000); return () => clearTimeout(t); } }, [confirmDelete]);

  return (
    <div className="bg-zinc-900/60 rounded-lg border border-white/[0.06] overflow-hidden">
      <div className="flex items-stretch">
        <div className="w-1 shrink-0" style={{ backgroundColor: fence.color || '#6366f1' }} />
        <div className="flex-1 p-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {editing ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="flex-1 min-w-0 bg-zinc-800 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-zinc-100 outline-none focus:border-indigo-500/50" autoFocus />
                <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300"><Check size={12} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={clsx('w-2 h-2 rounded-full shrink-0', fence.active ? 'bg-emerald-400' : 'bg-zinc-600')} />
                <span className="text-[11px] font-medium text-zinc-200 truncate">{fence.name}</span>
              </div>
            )}
            <span className={clsx('text-[9px] font-semibold tracking-wider shrink-0', fence.active ? 'text-emerald-400' : 'text-zinc-500')}>
              {fence.active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          <div className="text-[10px] text-zinc-500 font-mono mb-2">
            {fence.type === 'circle' ? 'Circle' : 'Polygon'} &middot; {formatSize(fence)}
          </div>

          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-1.5">
              <span className="text-[9px] text-zinc-500 tracking-wider">ENTRY</span>
              <ToggleSwitch on={!!fence.alertOnEntry} onChange={() => onUpdate(fence.id, { alertOnEntry: !fence.alertOnEntry })} />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-[9px] text-zinc-500 tracking-wider">EXIT</span>
              <ToggleSwitch on={!!fence.alertOnExit} onChange={() => onUpdate(fence.id, { alertOnExit: !fence.alertOnExit })} />
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => { setEditing(true); setName(fence.name); }}
              className="px-2 py-0.5 text-[9px] tracking-wider text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded border border-white/[0.04] transition-colors">
              <Pencil size={10} className="inline mr-1" />EDIT
            </button>
            <button onClick={() => onToggle(fence.id)}
              className="px-2 py-0.5 text-[9px] tracking-wider text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded border border-white/[0.04] transition-colors">
              {fence.active ? 'DISABLE' : 'ENABLE'}
            </button>
            <button onClick={handleDelete}
              className={clsx('px-2 py-0.5 text-[9px] tracking-wider rounded border transition-colors',
                confirmDelete ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-zinc-400 hover:text-red-400 bg-zinc-800/60 hover:bg-zinc-800 border-white/[0.04]')}>
              <Trash2 size={10} className="inline mr-1" />{confirmDelete ? 'CONFIRM' : 'DELETE'}
            </button>

            <div className="ml-auto flex items-center gap-1">
              {ZONE_COLORS.map((c) => (
                <button key={c} onClick={() => onUpdate(fence.id, { color: c })}
                  className={clsx('w-3 h-3 rounded-full border transition-transform hover:scale-125', fence.color === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeofenceManager() {
  const { geofences, geofenceManagerOpen, setGeofenceManagerOpen, removeGeofence, updateGeofence, toggleGeofence, startDrawGeofence } = useMapStore();
  const panelRef = useRef(null);

  const handleClose = useCallback(() => setGeofenceManagerOpen(false), [setGeofenceManagerOpen]);

  useEffect(() => {
    if (!geofenceManagerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) handleClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [geofenceManagerOpen, handleClose]);

  const handleNew = () => {
    startDrawGeofence('circle');
    toast('Click map to set center, click again for radius', 'info');
  };

  return (
    <AnimatePresence>
      {geofenceManagerOpen && (
        <motion.div ref={panelRef}
          initial={{ x: -320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -320, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="absolute left-3 top-3 bottom-14 z-30 w-[300px] bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-400">GEOFENCE ZONES</span>
            <div className="flex items-center gap-1.5">
              <button onClick={handleNew}
                className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded border border-indigo-500/20 transition-colors">
                <Plus size={10} />NEW
              </button>
              <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin">
            {geofences.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-[11px]">No geofence zones defined</div>
            )}
            {geofences.map((fence) => (
              <GeofenceCard key={fence.id} fence={fence} onToggle={toggleGeofence} onDelete={removeGeofence} onUpdate={updateGeofence} />
            ))}
          </div>

          <div className="px-3 py-2 border-t border-white/[0.06] text-[9px] text-zinc-600 tracking-wider text-center">
            {geofences.length} ZONE{geofences.length !== 1 ? 'S' : ''} &middot; {geofences.filter((g) => g.active).length} ACTIVE
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
