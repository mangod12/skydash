import { create } from 'zustand';
import {
  DEFAULT_FLEET_PRESET_ID,
  DEFAULT_SCENARIO_ID,
  SCENARIO_SPEEDS,
  buildScenarioFrame,
  getFleetPresetById,
  getInjectionById,
  getScenarioById,
} from '../utils/scenarioEngine';

export function getInitialScenarioState() {
  return {
    activeScenarioId: DEFAULT_SCENARIO_ID,
    selectedFleetPresetId: DEFAULT_FLEET_PRESET_ID,
    status: 'idle',
    elapsedSeconds: 0,
    speed: 1,
    injectedEvents: [],
  };
}

export const useScenarioStore = create((set, get) => ({
  ...getInitialScenarioState(),

  selectScenario: (scenarioId) => {
    const scenario = getScenarioById(scenarioId);
    set({
      activeScenarioId: scenario.id,
      status: 'idle',
      elapsedSeconds: 0,
      injectedEvents: [],
    });
  },

  selectFleetPreset: (presetId) => {
    const preset = getFleetPresetById(presetId);
    set({ selectedFleetPresetId: preset.id });
  },

  start: () => {
    const state = get();
    const scenario = getScenarioById(state.activeScenarioId);
    set({
      status: 'running',
      elapsedSeconds: state.elapsedSeconds >= scenario.durationSeconds ? 0 : state.elapsedSeconds,
    });
  },

  pause: () => {
    if (get().status === 'running') set({ status: 'paused' });
  },

  reset: () => set({
    status: 'idle',
    elapsedSeconds: 0,
    injectedEvents: [],
  }),

  resetLab: () => set(getInitialScenarioState()),

  setSpeed: (speed) => {
    const safeSpeed = SCENARIO_SPEEDS.includes(speed) ? speed : 1;
    set({ speed: safeSpeed });
  },

  seek: (elapsedSeconds) => {
    const scenario = getScenarioById(get().activeScenarioId);
    const next = Math.max(0, Math.min(scenario.durationSeconds, elapsedSeconds));
    const currentStatus = get().status;
    set({
      elapsedSeconds: next,
      status: next >= scenario.durationSeconds
        ? 'complete'
        : currentStatus === 'complete' ? 'paused' : currentStatus,
    });
  },

  tick: (deltaSeconds = 1) => {
    const state = get();
    if (state.status !== 'running') return;
    const scenario = getScenarioById(state.activeScenarioId);
    const next = Math.min(scenario.durationSeconds, state.elapsedSeconds + Math.max(0, deltaSeconds));
    set({
      elapsedSeconds: next,
      status: next >= scenario.durationSeconds ? 'complete' : 'running',
    });
  },

  injectEvent: (eventId) => {
    const config = getInjectionById(eventId);
    if (!config) return false;
    const state = get();
    if (state.injectedEvents.some((event) => event.id === config.id)) return false;
    set({
      injectedEvents: [
        ...state.injectedEvents,
        { id: config.id, injectedAt: state.elapsedSeconds },
      ],
    });
    return true;
  },

  getFrame: () => buildScenarioFrame(get()),
}));
