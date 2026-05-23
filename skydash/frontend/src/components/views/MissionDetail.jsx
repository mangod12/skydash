import { useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, FileText, MapPin, Clock, Plus, X, ChevronRight, Trash2, ScrollText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMissionStore } from '../../stores/missionStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';
import EntityCard from '../intel/EntityCard';
import MissionBriefingTab from './MissionBriefingTab';

const TABS = [
  { id: 'entities', label: 'ENTITIES', icon: Target },
  { id: 'notes', label: 'NOTES', icon: FileText },
  { id: 'briefing', label: 'BRIEFING', icon: ScrollText },
  { id: 'map', label: 'MAP', icon: MapPin },
  { id: 'timeline', label: 'TIMELINE', icon: Clock },
];

const STATUS_STYLE = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  closed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  archived: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

function MissionHeader({ mission }) {
  return (
    <div className="p-4 border-b border-white/[0.06] shrink-0 bg-zinc-900/60 backdrop-blur">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold tracking-wider text-zinc-100">{mission.name}</h2>
        <span className={clsx('text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded border', STATUS_STYLE[mission.status] || STATUS_STYLE.active)}>{mission.status?.toUpperCase()}</span>
      </div>
      {mission.description && <p className="text-[11px] text-zinc-500 mt-1">{mission.description}</p>}
      <div className="flex gap-3 mt-1.5 text-[9px] text-zinc-600 font-mono tabular-nums">
        <span>Created: {mission.created_at ? new Date(mission.created_at).toLocaleDateString() : '\u2014'}</span>
        <span>Updated: {mission.updated_at ? new Date(mission.updated_at).toLocaleDateString() : '\u2014'}</span>
      </div>
    </div>
  );
}

function TabBar({ tab, onTab }) {
  return (
    <div className="flex border-b border-white/[0.06] shrink-0">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => onTab(t.id)} className={clsx('flex items-center gap-2 px-4 py-2.5 text-[10px] font-semibold tracking-[0.1em] transition-colors', tab === t.id ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-600 hover:text-zinc-400')}>
          <t.icon size={12} /> {t.label}
        </button>
      ))}
    </div>
  );
}

function EntitiesTab({ mission }) {
  const entities = useIntelStore((s) => s.entities);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const { addEntityToMission, removeEntityFromMission } = useMissionStore();
  const [picking, setPicking] = useState(false);
  const linkedIds = mission.entityIds || [];
  const linked = entities.filter((e) => linkedIds.includes(e.id));
  const available = entities.filter((e) => !linkedIds.includes(e.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">{linked.length} LINKED ENTITIES</span>
        <button onClick={() => setPicking(!picking)} className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/15 text-indigo-400 text-[9px] font-semibold tracking-wider hover:bg-indigo-500/25 transition-colors"><Plus size={10} /> ADD ENTITY</button>
      </div>
      {picking && available.length > 0 && (
        <div className="mb-3 p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] max-h-40 overflow-y-auto space-y-1">
          {available.map((e) => (
            <button key={e.id} onClick={() => { addEntityToMission(mission.id, e.id); setPicking(false); }} className="w-full text-left px-2 py-1.5 text-[11px] text-zinc-300 hover:bg-white/[0.04] rounded flex items-center gap-2">
              <ChevronRight size={10} className="text-zinc-600" /> {e.name} <span className="text-zinc-600 text-[9px]">{e.type}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2">
        {linked.map((e) => (
          <div key={e.id} className="relative group">
            <EntityCard entity={e} selected={false} onClick={() => selectEntity(e.id)} />
            <button onClick={() => removeEntityFromMission(mission.id, e.id)} className="absolute top-2 right-2 p-1 rounded bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
          </div>
        ))}
        {linked.length === 0 && <div className="text-zinc-700 text-[10px] tracking-wider text-center py-6">NO ENTITIES LINKED</div>}
      </div>
    </div>
  );
}

function NotesTab({ mission }) {
  const { addNote, deleteNote } = useMissionStore();
  const [input, setInput] = useState('');
  const notes = mission.notes || [];
  const handleAdd = async () => { if (!input.trim()) return; await addNote(mission.id, input.trim()); setInput(''); };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Add analyst note..." className="flex-1 px-3 py-2 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/30" />
        <button onClick={handleAdd} className="px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-semibold tracking-wider hover:bg-indigo-500/25 transition-colors">ADD</button>
      </div>
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="p-3 rounded-lg border border-white/[0.04] bg-white/[0.02] group">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-zinc-300 leading-relaxed">{n.content}</p>
              <button onClick={() => deleteNote(mission.id, n.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={10} /></button>
            </div>
            <div className="text-[9px] text-zinc-600 font-mono tabular-nums mt-1.5">{n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}</div>
          </div>
        ))}
        {notes.length === 0 && <div className="text-zinc-700 text-[10px] tracking-wider text-center py-6">NO NOTES YET</div>}
      </div>
    </div>
  );
}

function MapTab({ mission }) {
  const { center, zoom } = useMapStore();
  const updateMission = useMissionStore((s) => s.updateMission);
  const saveView = () => updateMission(mission.id, { center_lat: center[0], center_lng: center[1], zoom_level: zoom });

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">SAVED MAP CONTEXT</h4>
        <div className="font-mono tabular-nums text-[11px] text-zinc-400">
          {mission.center_lat != null ? `${mission.center_lat.toFixed(6)}, ${mission.center_lng.toFixed(6)} at zoom ${mission.zoom_level}` : 'No map view saved'}
        </div>
      </div>
      <button onClick={saveView} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-semibold tracking-wider hover:bg-indigo-500/25 transition-colors">
        <MapPin size={12} /> SAVE CURRENT VIEW
      </button>
    </div>
  );
}

function TimelineTab({ mission }) {
  const events = useIntelStore((s) => s.events);
  const linkedIds = mission.entityIds || [];
  const filtered = events.filter((e) => linkedIds.includes(e.entityId)).sort((a, b) => b.time - a.time);

  return (
    <div>
      <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">{filtered.length} EVENTS</span>
      <div className="mt-3 space-y-2">
        {filtered.map((e) => (
          <div key={e.id} className="p-3 rounded-lg border border-white/[0.04] bg-white/[0.02]">
            <div className="text-[11px] text-zinc-300">{e.description}</div>
            <div className="text-[9px] text-zinc-600 font-mono tabular-nums mt-1">{formatDistanceToNow(e.time, { addSuffix: true })}</div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-zinc-700 text-[10px] tracking-wider text-center py-6">NO EVENTS FOR LINKED ENTITIES</div>}
      </div>
    </div>
  );
}

export default function MissionDetail({ mission, tab, onTab }) {
  return (
    <>
      <MissionHeader mission={mission} />
      <TabBar tab={tab} onTab={onTab} />
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'entities' && <EntitiesTab mission={mission} />}
            {tab === 'notes' && <NotesTab mission={mission} />}
            {tab === 'briefing' && <MissionBriefingTab mission={mission} />}
            {tab === 'map' && <MapTab mission={mission} />}
            {tab === 'timeline' && <TimelineTab mission={mission} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
