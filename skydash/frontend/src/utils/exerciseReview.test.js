import { beforeEach, describe, expect, it } from 'vitest';
import { captureExerciseReview, validateExerciseReview, readExerciseArchive, writeExerciseArchive, exerciseComparison, formatExerciseReview, EXERCISE_ARCHIVE_KEY } from './exerciseReview';
import { DEFAULT_SCENARIO_ID, DEFAULT_FLEET_PRESET_ID, SCENARIOS } from './scenarioEngine';
const state = () => ({ activeScenarioId: DEFAULT_SCENARIO_ID, selectedFleetPresetId: DEFAULT_FLEET_PRESET_ID, status: 'paused', elapsedSeconds: 60, injectedEvents: [] });
const capture = (id = 'a', input = state()) => captureExerciseReview(input, { id, title: `Review ${id}`, notes: 'Observe model differences.', now: 1800000000000 });
let storage;
beforeEach(() => { const data = new Map(); storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; });

describe('exercise review snapshots', () => {
  it('captures an independent configuration and only conditions active at this time', () => {
    const input = state(); input.injectedEvents = [{ id: 'signal-loss', injectedAt: 30 }, { id: 'battery-drain', injectedAt: 100 }];
    const review = capture('a', input);
    expect(review.configuration.injectedEvents).toEqual([{ id: 'signal-loss', injectedAt: 30 }]);
    input.injectedEvents[0].injectedAt = 0; input.elapsedSeconds = 100;
    expect(review.configuration.elapsedSeconds).toBe(60);
    expect(review.configuration.injectedEvents[0].injectedAt).toBe(30);
  });
  it.each(['idle', 'running', 'unknown'])('does not save %s as a paused or completed review', status => {
    expect(() => capture('a', { ...state(), status })).toThrow();
  });
  it.each([NaN, Infinity, -1, 0, '60', null, 1e10])('rejects invalid elapsed time %s', elapsedSeconds => {
    expect(() => capture('a', { ...state(), elapsedSeconds })).toThrow();
  });
  it('keeps captured scores and event evidence independent of later configuration changes', () => {
    const input = state(); const review = capture('frozen', input);
    const output = formatExerciseReview(review); const score = structuredClone(review.scorecard);
    input.injectedEvents.push({ id: 'signal-loss', injectedAt: 20 }); input.elapsedSeconds = 120;
    expect(review.scorecard).toEqual(score); expect(formatExerciseReview(review)).toBe(output);
    for (const patch of [{ coverage: NaN }, { detections: -1 }, { batteryReserve: 101 }, { grade: 'certified' }]) {
      expect(validateExerciseReview({ ...review, scorecard: { ...review.scorecard, ...patch } })).toBe(false);
    }
    expect(validateExerciseReview({ ...review, events: [{ label: 'Invalid future', type: 'detection', time: 61, injected: false }] })).toBe(false);
  });
  it('requires real title and bounded notes, known model, scenario and preset', () => {
    for (const patch of [{ title: '' }, { title: ' '.repeat(5) }, { title: 'x'.repeat(121) }, { notes: 'x'.repeat(2001) }, { model: 'unknown' }, { savedAt: Infinity }, { savedAt: 9e15 }]) {
      expect(validateExerciseReview({ ...capture(), ...patch })).toBe(false);
    }
    const review = capture();
    for (const patch of [{ activeScenarioId: 'invalid' }, { selectedFleetPresetId: 'invalid' }, { injectedEvents: [{ id: 'fake', injectedAt: 0 }] }, { injectedEvents: [{ id: 'signal-loss', injectedAt: 0 }, { id: 'signal-loss', injectedAt: 1 }] }]) {
      expect(validateExerciseReview({ ...review, configuration: { ...review.configuration, ...patch } })).toBe(false);
    }
    expect(() => captureExerciseReview(state(), { id: 'a', title: null })).toThrow();
  });
  it('distinguishes complete from partial snapshots even when timeline seeking is used', () => {
    const duration = SCENARIOS.find(item => item.id === DEFAULT_SCENARIO_ID).durationSeconds;
    expect(validateExerciseReview(capture('a', { ...state(), status: 'complete', elapsedSeconds: duration }))).toBe(true);
    expect(() => capture('a', { ...state(), status: 'complete' })).toThrow();
    expect(() => capture('a', { ...state(), elapsedSeconds: duration })).toThrow();
  });
});

describe('browser review archive', () => {
  it('round trips reviews and treats absent data as an empty archive', () => {
    expect(readExerciseArchive(storage)).toEqual({ reviews: [], error: '' });
    writeExerciseArchive(storage, [capture()]);
    expect(readExerciseArchive(storage)).toEqual({ reviews: [capture()], error: '' });
  });
  it.each(['null', '{}', '{oops', '[{}]', 'x'.repeat(200001)])('does not overwrite an invalid archive', raw => {
    storage.setItem(EXERCISE_ARCHIVE_KEY, raw);
    expect(readExerciseArchive(storage).error).not.toBe('');
    expect(storage.getItem(EXERCISE_ARCHIVE_KEY)).toBe(raw);
    expect(() => writeExerciseArchive(storage, [capture()], [])).toThrow('Archive changed');
  });
  it('rejects duplicate ids and an over-capacity archive', () => {
    expect(() => writeExerciseArchive(storage, [capture(), capture()])).toThrow();
    expect(() => writeExerciseArchive(storage, Array.from({ length: 21 }, (_, i) => capture(String(i))))).toThrow();
  });
  it('keeps writes honest on quota failure and protects concurrent tab updates', () => {
    writeExerciseArchive(storage, [capture()]);
    expect(() => writeExerciseArchive(storage, [], [])).toThrow('Archive changed');
    expect(readExerciseArchive(storage).reviews).toHaveLength(1);
    const denied = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(() => writeExerciseArchive(denied, [capture()])).toThrow('quota');
    expect(readExerciseArchive({ getItem: () => { throw new Error('denied'); } }).error).not.toBe('');
  });
});

describe('fair model comparisons and exports', () => {
  it('compares score deltas for the same scenario/model/progress', () => {
    const baseline = capture();
    const current = capture('b', { ...state(), injectedEvents: [{ id: 'signal-loss', injectedAt: 10 }] });
    const comparison = exerciseComparison(current, baseline);
    expect(comparison.error).toBeUndefined();
    expect(comparison.deltas).toHaveLength(4);
    for (const item of comparison.deltas) expect(item.delta).toBe(item.current - item.baseline);
  });
  it('rejects same record, different elapsed, scenario or model', () => {
    const review = capture();
    expect(exerciseComparison(review, review).error).toContain('different baseline');
    expect(exerciseComparison(review, capture('b', { ...state(), elapsedSeconds: 70 })).error).toContain('same scenario');
    expect(exerciseComparison(review, capture('b', { ...state(), activeScenarioId: SCENARIOS.find(item => item.id !== DEFAULT_SCENARIO_ID).id })).error).toContain('same scenario');
    expect(exerciseComparison(review, { ...capture('b'), model: 'v2' }).error).toBeTruthy();
  });
  it('exports scenario, title, model, elapsed, notes, events, comparison and honest scope', () => {
    const review = capture(); const output = formatExerciseReview(review, capture('b'));
    for (const phrase of ['EXERCISE AFTER-ACTION REVIEW', 'Review a', 'scenario-engine-v1', '60s', 'Observe model differences.', 'Model event timeline:', 'Baseline: Review b', 'delta +0', 'not measured field results', 'seeking', 'not team-shared', 'self-reported']) expect(output).toContain(phrase);
  });
});
