import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Shield, Target, Trash2, X } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { toast } from '../common/Toast';

const THREAT_LEVELS = ['none', 'low', 'medium', 'high', 'critical'];

export default function BulkActionsBar({ selectedIds, onClear }) {
  const [action, setAction] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateEntity = useIntelStore((s) => s.updateEntity);
  const deleteEntity = useIntelStore((s) => s.deleteEntity);
  const { activeMissionId, addEntityToMission } = useMissionStore();
  const count = selectedIds.size;

  const close = () => { setAction(null); setTagInput(''); setConfirmDelete(false); };

  const applyTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const entities = useIntelStore.getState().entities;
    selectedIds.forEach((id) => {
      const ent = entities.find((e) => e.id === id);
      if (ent) {
        const tags = ent.tags?.includes(tag) ? ent.tags : [...(ent.tags || []), tag];
        updateEntity(id, { tags });
      }
    });
    toast(`Tagged ${count} entities: "${tag}"`, 'success');
    close();
    onClear();
  };

  const applyThreat = (level) => {
    selectedIds.forEach((id) => updateEntity(id, { threatLevel: level }));
    toast(`Set ${count} entities to ${level.toUpperCase()} threat`, 'success');
    close();
    onClear();
  };

  const applyMission = () => {
    if (!activeMissionId) { toast('No active mission selected', 'warning'); return; }
    selectedIds.forEach((id) => addEntityToMission(activeMissionId, id));
    toast(`Added ${count} entities to mission`, 'success');
    close();
    onClear();
  };

  const applyDelete = () => {
    selectedIds.forEach((id) => deleteEntity(id));
    toast(`Deleted ${count} entities`, 'success');
    close();
    onClear();
  };

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      className="absolute bottom-0 left-0 right-0 mx-2 mb-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-zinc-900/80 backdrop-blur-xl shadow-2xl z-30"
    >
      {/* Confirm delete overlay */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl bg-zinc-900/95 backdrop-blur-xl flex items-center justify-center gap-3 z-40"
          >
            <span className="text-[11px] text-zinc-300">Delete {count} entities?</span>
            <button onClick={applyDelete} className="text-[10px] px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500">DELETE</button>
            <button onClick={() => setConfirmDelete(false)} className="text-[10px] px-3 py-1 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">CANCEL</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag input popover */}
      <AnimatePresence>
        {action === 'tag' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-2 mb-1 p-2 rounded-lg border border-white/[0.08] bg-zinc-900/90 backdrop-blur-xl flex gap-2"
          >
            <input autoFocus value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyTag()}
              placeholder="Tag name..." className="text-[11px] px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded text-zinc-200 placeholder:text-zinc-600 outline-none w-32" />
            <button onClick={applyTag} className="text-[10px] px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500">ADD</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Threat picker popover */}
      <AnimatePresence>
        {action === 'threat' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-2 mb-1 p-2 rounded-lg border border-white/[0.08] bg-zinc-900/90 backdrop-blur-xl flex gap-1"
          >
            {THREAT_LEVELS.map((lvl) => (
              <button key={lvl} onClick={() => applyThreat(lvl)}
                className="text-[10px] px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 uppercase tracking-wider">
                {lvl}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bar */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-indigo-400 shrink-0">
          {count} SELECTED
        </span>
        <div className="flex items-center gap-1 flex-1">
          <ActionBtn icon={Tag} label="Tag" onClick={() => setAction(action === 'tag' ? null : 'tag')} active={action === 'tag'} />
          <ActionBtn icon={Shield} label="Threat" onClick={() => setAction(action === 'threat' ? null : 'threat')} active={action === 'threat'} />
          <ActionBtn icon={Target} label="Mission" onClick={applyMission} />
          <ActionBtn icon={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} danger />
        </div>
        <button onClick={() => { close(); onClear(); }} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-wider transition-colors ${
      danger ? 'text-red-400 hover:bg-red-500/10' : active ? 'bg-indigo-500/15 text-indigo-400' : 'text-zinc-400 hover:bg-white/[0.06]'
    }`}>
      <Icon size={12} strokeWidth={1.5} />
      {label.toUpperCase()}
    </button>
  );
}
