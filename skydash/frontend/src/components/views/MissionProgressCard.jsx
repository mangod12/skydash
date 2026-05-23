import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import GlassCard from '../common/GlassCard';

const PHASES = [
  { id: 'plan', label: 'PLAN', color: 'bg-indigo-500' },
  { id: 'deploy', label: 'DEPLOY', color: 'bg-cyan-500' },
  { id: 'execute', label: 'EXECUTE', color: 'bg-emerald-500' },
  { id: 'debrief', label: 'DEBRIEF', color: 'bg-amber-500' },
];

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function derivePhase(mission) {
  if (!mission) return -1;
  if (mission.status === 'archived') return 3;
  if (mission.status === 'closed') return 3;
  const entityCount = (mission.entityIds || []).length;
  const noteCount = (mission.notes || []).length;
  if (entityCount > 0 && noteCount > 0) return 2;
  if (entityCount > 0) return 1;
  return 0;
}

export default function MissionProgressCard({ mission }) {
  const [elapsed, setElapsed] = useState('00:00:00');
  const currentPhase = derivePhase(mission);

  useEffect(() => {
    if (!mission?.created_at) return;
    const start = new Date(mission.created_at).getTime();
    const tick = () => setElapsed(formatElapsed(Date.now() - start));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mission?.created_at]);

  if (!mission) {
    return (
      <GlassCard className="!p-4">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
          MISSION PROGRESS
        </h3>
        <div className="text-zinc-700 text-[10px] text-center py-4">NO ACTIVE MISSION</div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="!p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          MISSION PROGRESS
        </h3>
        <span className="text-[10px] font-mono text-cyan-400 tabular-nums">{elapsed}</span>
      </div>

      {/* Mission name */}
      <div className="text-xs font-semibold text-zinc-200 mb-3 truncate">
        {mission.name}
      </div>

      {/* Phase indicators */}
      <div className="flex items-center gap-1 mb-3">
        {PHASES.map((phase, i) => (
          <div key={phase.id} className="flex items-center flex-1">
            <div className={clsx(
              'w-full h-1.5 rounded-full transition-all',
              i <= currentPhase ? phase.color : 'bg-zinc-800',
              i === currentPhase && 'animate-pulse',
            )} />
            {i < PHASES.length - 1 && <div className="w-1 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Phase labels */}
      <div className="flex justify-between">
        {PHASES.map((phase, i) => (
          <span
            key={phase.id}
            className={clsx(
              'text-[7px] font-mono tracking-wider',
              i <= currentPhase ? 'text-zinc-400' : 'text-zinc-700',
              i === currentPhase && 'font-bold',
            )}
          >
            {phase.label}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
        <div className="text-center flex-1">
          <div className="text-[8px] text-zinc-600 tracking-wider">ENTITIES</div>
          <div className="text-sm font-mono font-bold text-indigo-400 tabular-nums">
            {(mission.entityIds || []).length}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-[8px] text-zinc-600 tracking-wider">NOTES</div>
          <div className="text-sm font-mono font-bold text-cyan-400 tabular-nums">
            {(mission.notes || []).length}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-[8px] text-zinc-600 tracking-wider">STATUS</div>
          <div className={clsx(
            'text-[9px] font-bold tracking-wider',
            mission.status === 'active' ? 'text-emerald-400' : 'text-zinc-500',
          )}>
            {(mission.status || 'ACTIVE').toUpperCase()}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
