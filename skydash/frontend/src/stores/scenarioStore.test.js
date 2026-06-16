import { beforeEach, describe, expect, it } from 'vitest';
import { useScenarioStore } from './scenarioStore';
import { getScenarioById } from '../utils/scenarioEngine';

describe('scenarioStore', () => {
  beforeEach(() => {
    useScenarioStore.getState().resetLab();
  });

  it('selects a scenario and resets mission runtime state', () => {
    const store = useScenarioStore.getState();

    store.start();
    store.tick(30);
    store.injectEvent('wind-shift');
    store.selectScenario('missing-hiker');

    const state = useScenarioStore.getState();
    expect(state.activeScenarioId).toBe('missing-hiker');
    expect(state.status).toBe('idle');
    expect(state.elapsedSeconds).toBe(0);
    expect(state.injectedEvents).toHaveLength(0);
  });

  it('starts, ticks, pauses, and resets playback', () => {
    useScenarioStore.getState().start();
    useScenarioStore.getState().tick(20);

    expect(useScenarioStore.getState().status).toBe('running');
    expect(useScenarioStore.getState().elapsedSeconds).toBe(20);

    useScenarioStore.getState().pause();
    useScenarioStore.getState().tick(20);

    expect(useScenarioStore.getState().status).toBe('paused');
    expect(useScenarioStore.getState().elapsedSeconds).toBe(20);

    useScenarioStore.getState().reset();
    expect(useScenarioStore.getState().status).toBe('idle');
    expect(useScenarioStore.getState().elapsedSeconds).toBe(0);
  });

  it('marks a scenario complete when ticking to the duration', () => {
    const duration = getScenarioById(useScenarioStore.getState().activeScenarioId).durationSeconds;

    useScenarioStore.getState().start();
    useScenarioStore.getState().tick(duration + 10);

    expect(useScenarioStore.getState().status).toBe('complete');
    expect(useScenarioStore.getState().elapsedSeconds).toBe(duration);
  });

  it('deduplicates injected events', () => {
    const first = useScenarioStore.getState().injectEvent('new-detection');
    const second = useScenarioStore.getState().injectEvent('new-detection');

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(useScenarioStore.getState().injectedEvents).toHaveLength(1);
  });

  it('normalizes invalid fleet speed and exposes a frame', () => {
    useScenarioStore.getState().selectFleetPreset('wide-area');
    useScenarioStore.getState().setSpeed(99);

    const state = useScenarioStore.getState();
    const frame = state.getFrame();

    expect(state.selectedFleetPresetId).toBe('wide-area');
    expect(state.speed).toBe(1);
    expect(frame.preset.id).toBe('wide-area');
  });
});
