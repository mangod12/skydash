import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMissionStore } from '../../stores/missionStore';
import { useUIStore } from '../../stores/uiStore';

const STATUS_STYLE = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  closed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  archived: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export default function MissionList({ missions, activeId, onSelect, loading }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const createMission = useMissionStore((s) => s.createMission);
  const missionCreateOpen = useUIStore((s) => s.missionCreateOpen);
  const setMissionCreateOpen = useUIStore((s) => s.setMissionCreateOpen);

  useEffect(() => {
    if (missionCreateOpen) {
      const id = requestAnimationFrame(() => {
        setCreating(true);
        setMissionCreateOpen(false);
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [missionCreateOpen, setMissionCreateOpen]);

  const handleCreate = async (event) => {
    event?.preventDefault();
    if (!name.trim()) return;
    const m = await createMission({ name: name.trim(), description: desc.trim() });
    if (m) { onSelect(m.id); setCreating(false); setName(''); setDesc(''); }
  };

  return (
    <div className="w-80 shrink-0 border-r border-white/[0.06] flex flex-col">
      <div className="p-3 border-b border-white/[0.06] shrink-0">
        <button
          onClick={() => setCreating(!creating)}
          aria-expanded={creating}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-semibold tracking-[0.15em] hover:bg-indigo-500/25 transition-colors"
        >
          <Plus size={12} /> NEW MISSION
        </button>
        {creating && (
          <form className="mt-2 space-y-2" onSubmit={handleCreate}>
            <label className="sr-only" htmlFor="mission-name">Mission name</label>
            <input id="mission-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mission name..." className="w-full px-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/30" />
            <label className="sr-only" htmlFor="mission-description">Mission description</label>
            <input id="mission-description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description..." className="w-full px-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/30" />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[10px] font-semibold tracking-wider hover:bg-indigo-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                CREATE
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Cancel new mission"
                className="px-3 py-1.5 rounded-lg text-zinc-500 text-[10px] hover:text-zinc-300 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </form>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && <div className="text-center text-zinc-600 text-[10px] tracking-wider py-8">LOADING...</div>}
        {!loading && missions.length === 0 && <div className="text-center text-zinc-700 text-[10px] tracking-wider py-8">NO MISSIONS YET</div>}
        {missions.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            aria-pressed={activeId === m.id}
            className={clsx('w-full text-left p-3 rounded-xl border transition-all', activeId === m.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]')}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 truncate">{m.name}</span>
              <span className={clsx('text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded border', STATUS_STYLE[m.status] || STATUS_STYLE.active)}>{m.status?.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-600">
              <span className="font-mono tabular-nums">{(m.entityIds || []).length} entities</span>
              <span>&middot;</span>
              <span className="font-mono tabular-nums">{m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true }) : ''}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
