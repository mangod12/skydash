import { calculateBearing } from './bearing';
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
  it.each([0, 1, 5, 14])('never draws a future trail point at second %s', (elapsedSeconds) => {
    const frame = buildScenarioFrame({ ...baseState, elapsedSeconds });
    frame.paths.forEach((path, index) => {
      const drone = frame.fleet[index];
      const latest = [drone.gps.latitude, drone.gps.longitude];
      expect(path.points.at(-1)).toEqual(latest);
      expect(path.points).toHaveLength(elapsedSeconds === 0 ? 1 : 2);
    });
  });

  it('replaying before an injection restores clean telemetry and scores until the event occurs', () => {
    const clean = buildScenarioFrame({ ...baseState, elapsedSeconds: 44 });
    const replay = buildScenarioFrame({ ...baseState, elapsedSeconds: 44, injectedEvents: [{ id: 'signal-loss', injectedAt: 45 }] });
    expect(replay).toEqual(clean);
    const atEvent = buildScenarioFrame({ ...baseState, elapsedSeconds: 45, injectedEvents: [{ id: 'signal-loss', injectedAt: 45 }] });
    expect(atEvent.events.some((e) => e.injected)).toBe(true);
    expect(atEvent.fleet[0].signal_strength).toBeLessThan(clean.fleet[0].signal_strength);
  });

  it('ignores malformed injections and non-finite playback inputs', () => {
    const zero = buildScenarioFrame({ ...baseState, elapsedSeconds: 0 });
    expect(buildScenarioFrame({ ...baseState, elapsedSeconds: NaN, injectedEvents: [null, { id: 'unknown', injectedAt: 0 }, { id: 'wind-shift', injectedAt: -1 }, { id: 'wind-shift', injectedAt: '0' }] })).toEqual(zero);
    expect(buildScenarioFrame({ ...baseState, elapsedSeconds: Infinity, injectedEvents: {} })).toEqual(zero);
    expect(formatScenarioTime(Infinity)).toBe('00:00');
    expect(formatScenarioTime(NaN)).toBe('00:00');
  });

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

  it('uses a geographic bearing for drone heading at the scenario latitude', () => {
    const previous = buildScenarioFrame({ ...baseState, elapsedSeconds: 85 });
    const current = buildScenarioFrame(baseState);
    current.fleet.forEach((drone, index) => {
      const prev = previous.fleet[index].gps;
      const next = drone.gps;
      expect(drone.attitude.yaw).toBe(Math.round(calculateBearing(prev.latitude, prev.longitude, next.latitude, next.longitude)) % 360);
    });
  });

  it('formats scenario timeline values', () => {
    expect(formatScenarioTime(0)).toBe('00:00');
    expect(formatScenarioTime(125)).toBe('02:05');
  });
});
