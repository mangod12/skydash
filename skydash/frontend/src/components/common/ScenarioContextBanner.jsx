import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Radar, Gauge, MapPinned, PlayCircle, PauseCircle } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useUIStore } from '../../stores/uiStore';
import { buildScenarioFrame, formatScenarioTime } from '../../utils/scenarioEngine';

const STATUS_STYLE = {
  running: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  complete: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
};

export default function ScenarioContextBanner() {
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
    <div className="px-3 sm:px-4 pt-2">
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.06] backdrop-blur px-3 py-2 shadow-[0_0_30px_rgba(34,211,238,0.06)]"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 flex items-center justify-center shrink-0">
              <Radar size={16} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx('px-2 py-0.5 rounded-md border text-[8px] font-semibold tracking-[0.16em]', STATUS_STYLE[status] || STATUS_STYLE.paused)}>
                  {status.toUpperCase()}
                </span>
                <span className="text-[9px] font-mono text-zinc-500">T+{formatScenarioTime(elapsedSeconds)}</span>
                <span className="text-[9px] font-mono text-zinc-600">{frame.scenario.location}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-zinc-100">{frame.scenario.name}</span>
                <span className="text-[10px] text-zinc-500">|</span>
                <span className="text-[10px] text-zinc-500">{frame.preset.name}</span>
                <span className="text-[10px] text-zinc-500">|</span>
                <span className="text-[10px] text-zinc-500">{frame.injectedEvents.length} injects</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 min-w-[82px]">
              <div className="flex items-center gap-1.5 text-zinc-600 mb-0.5">
                <MapPinned size={11} />
                <span className="text-[8px] font-semibold tracking-wider">COVERAGE</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-cyan-300">{frame.scorecard.coverage}%</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 min-w-[82px]">
              <div className="flex items-center gap-1.5 text-zinc-600 mb-0.5">
                <Gauge size={11} />
                <span className="text-[8px] font-semibold tracking-wider">RISK</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-emerald-300">{frame.scorecard.riskReduced}%</div>
            </div>
            <button
              onClick={() => setActiveView('scenario')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[9px] font-semibold tracking-[0.15em] text-cyan-300 hover:bg-cyan-500/18 transition-colors"
            >
              {status === 'running' ? <PauseCircle size={12} /> : <PlayCircle size={12} />}
              OPEN LAB
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
