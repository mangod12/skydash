import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLEET_PRESET_ID,
  DEFAULT_SCENARIO_ID,
  buildScenarioFrame,
  formatScenarioTime,
} from './scenarioEngine';

const baseState = {
  activeScenarioId: DEFAULT_SCENARIO_ID,
  selectedFleetPresetId: DEFAULT_FLEET_PRESET_ID,
  elapsedSeconds: 90,
  injectedEvents: [],
};

describe('scenarioEngine', () => {
  it('generates deterministic frames for the same state', () => {
    const first = buildScenarioFrame(baseState);
    const second = buildScenarioFrame(baseState);

    expect(first).toEqual(second);
    expect(first.fleet).toHaveLength(3);
    expect(first.paths[0].points.length).toBeGreaterThan(1);
  });

  it('surfaces visible scenario events and mission metrics', () => {
    const frame = buildScenarioFrame(baseState);

    expect(frame.events.length).toBeGreaterThan(0);
    expect(frame.scorecard.coverage).toBeGreaterThan(0);
    expect(frame.scorecard.batteryReserve).toBeGreaterThan(0);
    expect(frame.primaryTelemetry.drone_id).toBe('SCN-01');
  });

  it('applies injected events to the scorecard and event list', () => {
    const clean = buildScenarioFrame(baseState);
    const withInject = buildScenarioFrame({
      ...baseState,
      injectedEvents: [{ id: 'signal-loss', injectedAt: 45 }],
    });

    expect(withInject.events.some((event) => event.injected)).toBe(true);
    expect(withInject.scorecard.riskReduced).toBeLessThan(clean.scorecard.riskReduced);
    expect(withInject.fleet[0].signal_strength).toBeLessThan(clean.fleet[0].signal_strength);
  });

  it('clamps progress at scenario completion', () => {
    const frame = buildScenarioFrame({ ...baseState, elapsedSeconds: 9999 });

    expect(frame.progress).toBe(100);
    expect(frame.remainingSeconds).toBe(0);
    expect(frame.elapsedSeconds).toBe(frame.scenario.durationSeconds);
  });

  it('formats scenario timeline values', () => {
    expect(formatScenarioTime(0)).toBe('00:00');
    expect(formatScenarioTime(125)).toBe('02:05');
  });
});
