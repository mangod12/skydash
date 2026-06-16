import { useMemo } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, Gauge, MapPinned, Radar } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useUIStore } from '../../stores/uiStore';
import { buildScenarioFrame, formatScenarioTime } from '../../utils/scenarioEngine';

const STATUS = {
  running: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  complete: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
};

export default function ScenarioSummaryCard() {
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const selectedFleetPresetId = useScenarioStore((s) => s.selectedFleetPresetId);
  const elapsedSeconds = useScenarioStore((s) => s.elapsedSeconds);
  const injectedEvents = useScenarioStore((s) => s.injectedEvents);
  const status = useScenarioStore((s) => s.status);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const frame = useMemo(
    () => buildScenarioFrame({ activeScenarioId, selectedFleetPresetId, elapsedSeconds, injectedEvents }),
    [activeScenarioId, elapsedSeconds, injectedEvents, selectedFleetPresetId],
  );

  if (status === 'idle') return null;

  return (
    <GlassCard className="!p-4 border-cyan-500/15" animate={false}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 flex items-center justify-center">
            <Radar size={18} strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx('px-2 py-0.5 rounded-md border text-[8px] font-semibold tracking-[0.16em]', STATUS[status])}>
                {status.toUpperCase()}
              </span>
              <span className="text-[9px] font-mono text-zinc-600">T+{formatScenarioTime(elapsedSeconds)}</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{frame.scenario.name}</div>
            <div className="text-[10px] text-zinc-500">{frame.preset.name} | {frame.scenario.location}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-0 lg:min-w-[360px]">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <div className="flex items-center justify-between text-zinc-600 mb-1">
              <span className="text-[8px] font-semibold tracking-wider">COVERAGE</span>
              <MapPinned size={11} />
            </div>
            <div className="text-sm font-mono font-bold text-cyan-300">{frame.scorecard.coverage}%</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <div className="flex items-center justify-between text-zinc-600 mb-1">
              <span className="text-[8px] font-semibold tracking-wider">RISK</span>
              <Gauge size={11} />
            </div>
            <div className="text-sm font-mono font-bold text-emerald-300">{frame.scorecard.riskReduced}%</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <div className="flex items-center justify-between text-zinc-600 mb-1">
              <span className="text-[8px] font-semibold tracking-wider">GRADE</span>
              <CheckCircle2 size={11} />
            </div>
            <div className="text-sm font-mono font-bold text-indigo-300">{frame.scorecard.grade}</div>
          </div>
        </div>

        <button
          onClick={() => setActiveView('scenario')}
          className="px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold tracking-[0.15em] hover:bg-cyan-500/18 transition-all"
        >
          OPEN LAB
        </button>
      </div>
    </GlassCard>
  );
}
