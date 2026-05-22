import { useState } from 'react';
import { Target, FileText, Send, ChevronRight } from 'lucide-react';
import { useMissionStore } from '../../stores/missionStore';
import { useUIStore } from '../../stores/uiStore';

export default function MissionPanel({ missionId }) {
  const missions = useMissionStore((s) => s.missions);
  const activeMissionId = useMissionStore((s) => s.activeMissionId);
  const addNote = useMissionStore((s) => s.addNote);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [noteText, setNoteText] = useState('');

  const id = missionId || activeMissionId;
  const mission = missions.find((m) => m.id === id);
  if (!mission) return null;

  const notes = mission.notes || [];
  const latestNote = notes[0];
  const entityCount = (mission.entityIds || []).length;

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(mission.id, noteText.trim());
    setNoteText('');
  };

  return (
    <div className="px-3 py-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target size={12} className="text-indigo-400" />
          <span className="text-[10px] font-semibold text-zinc-300 tracking-wider truncate">{mission.name}</span>
        </div>
        <button onClick={() => setActiveView('missions')}
          className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5">
          View <ChevronRight size={10} />
        </button>
      </div>
      <div className="flex items-center gap-3 text-[9px] text-zinc-600 font-mono mb-2">
        <span>{entityCount} entities</span>
        <span>{notes.length} notes</span>
        <span className="text-emerald-500/70">{(mission.status || 'active').toUpperCase()}</span>
      </div>
      {latestNote && (
        <div className="flex items-start gap-1.5 mb-2">
          <FileText size={10} className="text-zinc-700 mt-0.5 shrink-0" />
          <p className="text-[9px] text-zinc-500 line-clamp-2">{latestNote.content}</p>
        </div>
      )}
      <div className="flex gap-1.5">
        <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          placeholder="Quick note..."
          className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[10px] text-zinc-300 placeholder:text-zinc-700 outline-none" />
        <button onClick={handleAddNote} className="text-indigo-400 hover:text-indigo-300">
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
