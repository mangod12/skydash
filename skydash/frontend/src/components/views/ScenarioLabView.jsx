import { useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import {
  Activity,
  FastForward,
  Flame,
  Gauge,
  HeartPulse,
  MapPinned,
  Mountain,
  Pause,
  Plane,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { PanelBoundary } from '../common/ErrorBoundary';
import ScenarioOverlay from '../map/ScenarioOverlay';
import { useMapStore } from '../../stores/mapStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useUIStore } from '../../stores/uiStore';
import {
  FLEET_PRESETS,
  INJECTION_EVENTS,
  SCENARIOS,
  SCENARIO_SPEEDS,
  SIMULATION_STEP_SECONDS,
  buildScenarioFrame,
  formatScenarioTime,
} from '../../utils/scenarioEngine';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const SCENARIO_ICONS = {
  fire: Flame,
  relief: HeartPulse,
  airspace: Plane,
  rescue: Mountain,
};

const STATUS_STYLES = {
  idle: 'text-zinc-500 bg-white/[0.04] border-white/[0.08]',
  running: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  complete: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
};

function ScenarioMapSync({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, map, zoom]);

  return null;
}

function ScenarioCard({ scenario, active, onSelect }) {
  const Icon = SCENARIO_ICONS[scenario.icon] || MapPinned;
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'text-left p-3 rounded-xl border transition-all min-h-[116px] min-w-[280px] xl:min-w-0',
        active
          ? 'bg-indigo-500/12 border-indigo-500/35 shadow-[0_0_24px_rgba(99,102,241,0.12)]'
          : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center border"
          style={{ color: scenario.accent, borderColor: `${scenario.accent}55`, backgroundColor: `${scenario.accent}16` }}
        >
          <Icon size={17} strokeWidth={1.6} />
        </div>
        <span className="text-[8px] font-bold tracking-[0.16em] text-zinc-600">{scenario.tag}</span>
      </div>
      <div className="mt-3 text-sm font-semibold text-zinc-100">{scenario.name}</div>
      <div className="mt-1 text-[10px] font-mono text-zinc-500">{scenario.location}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{scenario.objective}</p>
    </button>
  );
}

function FleetPresetCard({ preset, active, disabled, onSelect }) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={clsx(
        'text-left p-3 rounded-xl border transition-all',
        active
          ? 'bg-cyan-500/10 border-cyan-500/30'
          : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05]',
        disabled && !active && 'opacity-40 cursor-not-allowed hover:bg-white/[0.025]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-200">{preset.name}</span>
        <span className="text-[9px] font-mono text-cyan-400">{preset.drones.length} ASSETS</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{preset.summary}</p>
    </button>
  );
}

function Metric({ label, value, icon: Icon, accent = 'text-cyan-400' }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[8px] font-semibold tracking-[0.15em] text-zinc-600">{label}</span>
        <Icon size={13} className="text-zinc-600" />
      </div>
      <div className={clsx('text-xl font-mono font-bold tabular-nums', accent)}>{value}</div>
    </div>
  );
}

function ScenarioMiniMap({ frame }) {
  return (
    <MapContainer
      key={frame.scenario.id}
      center={frame.scenario.center}
      zoom={frame.scenario.zoom}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full z-0"
      style={{ background: '#09090b' }}
    >
      <ScenarioMapSync center={frame.scenario.center} zoom={frame.scenario.zoom} />
      <TileLayer url={TILE_URL} maxZoom={20} maxNativeZoom={20} />
      <ScenarioOverlay frame={frame} showIdle compact />
    </MapContainer>
  );
}

function MissionResult({ frame }) {
  if (useScenarioStore.getState().status !== 'complete') return null;
  const { scenario, scorecard, elapsedSeconds } = frame;
  return (
    <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[9px] font-semibold tracking-[0.18em] text-cyan-300">MISSION RESULT</div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{scenario.name}</div>
        </div>
        <div className="text-3xl font-mono font-bold text-cyan-300">{scorecard.grade}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
        <span>{scorecard.coverage}% coverage</span>
        <span>{scorecard.riskReduced}% risk reduced</span>
        <span>{scorecard.detections} detections</span>
        <span>{formatScenarioTime(elapsedSeconds)} elapsed</span>
      </div>
    </div>
  );
}

export default function ScenarioLabView() {
  const {
    activeScenarioId,
    selectedFleetPresetId,
    status,
    elapsedSeconds,
    speed,
    injectedEvents,
    selectScenario,
    selectFleetPreset,
    start,
    pause,
    reset,
    setSpeed,
    seek,
    tick,
    injectEvent,
  } = useScenarioStore();

  const frame = useMemo(
    () => buildScenarioFrame({ activeScenarioId, selectedFleetPresetId, elapsedSeconds, injectedEvents }),
    [activeScenarioId, elapsedSeconds, injectedEvents, selectedFleetPresetId],
  );

  useEffect(() => {
    if (status !== 'running') return undefined;
    const id = setInterval(() => tick(speed * SIMULATION_STEP_SECONDS), 1000);
    return () => clearInterval(id);
  }, [speed, status, tick]);

  const handleSelectScenario = (scenario) => {
    selectScenario(scenario.id);
    useMapStore.getState().flyTo(scenario.center, scenario.zoom);
  };

  const handleOpenMap = () => {
    useMapStore.getState().flyTo(frame.scenario.center, frame.scenario.zoom);
    useUIStore.getState().setActiveView('map');
  };

  const canChangeFleet = status === 'idle';
  const progress = frame.progress;
  const nextSpeed = SCENARIO_SPEEDS[(SCENARIO_SPEEDS.indexOf(speed) + 1) % SCENARIO_SPEEDS.length];

  return (
    <PanelBoundary name="Scenario Lab">
      <div className="h-full overflow-y-auto overflow-x-hidden p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={clsx('px-2 py-1 rounded-lg border text-[9px] font-semibold tracking-[0.16em]', STATUS_STYLES[status])}>
                  {status.toUpperCase()}
                </span>
                <span className="text-[9px] font-mono text-zinc-600">SCENARIO SIMULATION</span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">Scenario Lab</h1>
              <p className="mt-1 text-sm text-zinc-500 max-w-2xl">
                {frame.scenario.objective}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={status === 'running' ? pause : start}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-semibold tracking-[0.15em] border transition-all',
                  status === 'running'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
                )}
              >
                {status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                {status === 'running' ? 'PAUSE' : 'LAUNCH'}
              </button>
              <button
                onClick={() => seek(elapsedSeconds + 30)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold tracking-[0.15em] border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-zinc-200 transition-all"
              >
                <FastForward size={14} /> STEP +30S
              </button>
              <button
                onClick={() => setSpeed(nextSpeed)}
                className="px-3 py-2 rounded-xl text-[10px] font-mono font-bold border border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
              >
                {speed}X
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold tracking-[0.15em] border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-zinc-200 transition-all"
              >
                <RotateCcw size={14} /> RESET
              </button>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0">
            {SCENARIOS.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                active={scenario.id === activeScenarioId}
                onSelect={() => handleSelectScenario(scenario)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-8 space-y-4">
              <GlassCard className="!p-0 overflow-hidden h-[460px] relative" animate={false}>
                <div className="absolute z-10 m-3 flex items-center gap-2">
                  <div className="rounded-lg border border-white/[0.08] bg-zinc-950/85 backdrop-blur px-3 py-1.5">
                    <span className="text-[9px] font-semibold tracking-[0.16em] text-zinc-500">MISSION AO</span>
                    <span className="ml-2 text-[10px] font-mono text-zinc-300">{frame.scenario.location}</span>
                  </div>
                </div>
                <ScenarioMiniMap frame={frame} />
              </GlassCard>

              <GlassCard className="!p-3" animate={false}>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-semibold tracking-[0.16em] text-zinc-500 shrink-0">
                    T+{formatScenarioTime(elapsedSeconds)}
                  </span>
                  <div className="relative h-7 flex-1 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400" style={{ width: `${progress}%` }} />
                    </div>
                    <input
                      aria-label="Scenario timeline"
                      type="range"
                      min={0}
                      max={frame.scenario.durationSeconds}
                      value={elapsedSeconds}
                      onChange={(event) => seek(Number(event.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="absolute w-3.5 h-3.5 rounded-full bg-cyan-300 border-2 border-cyan-600 shadow-[0_0_10px_rgba(34,211,238,0.55)] pointer-events-none"
                      style={{ left: `calc(${progress}% - 7px)` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                    {formatScenarioTime(frame.scenario.durationSeconds)}
                  </span>
                </div>
              </GlassCard>
            </div>

            <div className="xl:col-span-4 space-y-4">
              <GlassCard className="!p-4" animate={false}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">MISSION SCORE</span>
                  <button
                    onClick={handleOpenMap}
                    className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider text-zinc-500 hover:text-cyan-300 transition-colors"
                  >
                    <MapPinned size={12} /> MAP
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="COVERAGE" value={`${frame.scorecard.coverage}%`} icon={Gauge} accent="text-cyan-400" />
                  <Metric label="RISK REDUCED" value={`${frame.scorecard.riskReduced}%`} icon={ShieldCheck} accent="text-emerald-400" />
                  <Metric label="BATTERY" value={`${frame.scorecard.batteryReserve}%`} icon={Zap} accent={frame.scorecard.batteryReserve < 25 ? 'text-red-400' : 'text-amber-400'} />
                  <Metric label="DETECTIONS" value={frame.scorecard.detections} icon={Activity} accent="text-indigo-400" />
                </div>
                <MissionResult frame={frame} />
              </GlassCard>

              <GlassCard className="!p-4" animate={false}>
                <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-3">FLEET PRESET</span>
                <div className="space-y-2">
                  {FLEET_PRESETS.map((preset) => (
                    <FleetPresetCard
                      key={preset.id}
                      preset={preset}
                      active={preset.id === selectedFleetPresetId}
                      disabled={!canChangeFleet}
                      onSelect={() => canChangeFleet && selectFleetPreset(preset.id)}
                    />
                  ))}
                </div>
                {!canChangeFleet && (
                  <div className="mt-2 text-[9px] font-mono text-zinc-600">RESET TO CHANGE FLEET</div>
                )}
              </GlassCard>

              <GlassCard className="!p-4" animate={false}>
                <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-3">LIVE INJECTS</span>
                <div className="grid grid-cols-2 gap-2">
                  {INJECTION_EVENTS.map((event) => {
                    const alreadyInjected = injectedEvents.some((item) => item.id === event.id);
                    const disabled = status === 'idle' || status === 'complete' || alreadyInjected;
                    return (
                      <button
                        key={event.id}
                        disabled={disabled}
                        onClick={() => injectEvent(event.id)}
                        className={clsx(
                          'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[9px] font-semibold tracking-wider transition-all',
                          disabled
                            ? 'border-white/[0.05] bg-white/[0.02] text-zinc-700 cursor-not-allowed'
                            : 'border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/18',
                        )}
                      >
                        <Radio size={11} />
                        {alreadyInjected ? 'ACTIVE' : event.label.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </PanelBoundary>
  );
}
