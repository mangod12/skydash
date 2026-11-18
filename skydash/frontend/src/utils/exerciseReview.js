import { buildScenarioFrame, SCENARIOS, FLEET_PRESETS, INJECTION_EVENTS } from './scenarioEngine';

export const EXERCISE_ARCHIVE_KEY = 'skydash.exercise-reviews.v1';
// Bump this ID when the scenario model changes. Saved scores/events stay immutable.
export const EXERCISE_MODEL = 'scenario-engine-v1';
export const MAX_EXERCISE_REVIEWS = 20;
export const EXERCISE_SCOPE = 'SIMULATION ONLY. Scores are deterministic model estimates, not measured field results, operator certification or flight authorization. Timeline seeking can change the snapshot. Saved reviews stay in this browser, are not team-shared or tamper-evident and may be lost if browser data is cleared.';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function validateExerciseReview(value) {
  if (!object(value) || value.version !== 1 || value.model !== EXERCISE_MODEL
    || !text(value.id, 100) || !text(value.title, 120) || typeof value.notes !== 'string' || value.notes.length > 2000
    || !finite(value.savedAt) || value.savedAt < 0 || !Number.isFinite(new Date(value.savedAt).getTime())
    || !['paused', 'complete'].includes(value.status) || !object(value.configuration)
    || !text(value.scenarioName, 200) || !text(value.presetName, 200) || !object(value.scorecard)
    || !Array.isArray(value.events) || value.events.length > 32) return false;
  const score = value.scorecard;
  if (['coverage', 'batteryReserve', 'riskReduced'].some(key => !finite(score[key]) || score[key] < 0 || score[key] > 100)
    || !Number.isSafeInteger(score.detections) || score.detections < 0 || score.detections > 32
    || typeof score.success !== 'boolean' || !['A', 'B', 'C', 'D'].includes(score.grade)
    || (score.responseTime !== null && (!finite(score.responseTime) || score.responseTime < 0))) return false;
  const config = value.configuration;
  const scenario = SCENARIOS.find(item => item.id === config.activeScenarioId);
  if (!scenario || !FLEET_PRESETS.some(item => item.id === config.selectedFleetPresetId)
    || !finite(config.elapsedSeconds) || config.elapsedSeconds <= 0 || config.elapsedSeconds > scenario.durationSeconds
    || (value.status === 'complete') !== (config.elapsedSeconds === scenario.durationSeconds)
    || !Array.isArray(config.injectedEvents) || config.injectedEvents.length > INJECTION_EVENTS.length) return false;
  if (value.events.some(event => !object(event) || !text(event.label, 300) || !text(event.type, 50)
    || !finite(event.time) || event.time < 0 || event.time > config.elapsedSeconds || typeof event.injected !== 'boolean')) return false;
  const ids = new Set();
  return config.injectedEvents.every(item => {
    if (!object(item) || !INJECTION_EVENTS.some(inject => inject.id === item.id) || ids.has(item.id)
      || !finite(item.injectedAt) || item.injectedAt < 0 || item.injectedAt > config.elapsedSeconds) return false;
    ids.add(item.id); return true;
  });
}

export function captureExerciseReview(state, { id, title, notes = '', now = Date.now() }) {
  if (!state || typeof title !== 'string' || typeof notes !== 'string') throw new Error('Invalid review input');
  const frame = buildScenarioFrame(state);
  const review = { scenarioName: frame.scenario.name, presetName: frame.preset.name, scorecard: { ...frame.scorecard },
    events: frame.events.map(event => ({ label: event.label, type: event.type, time: event.time, injected: event.injected })), version: 1, model: EXERCISE_MODEL, id, title: title.trim(), notes: notes.trim(), savedAt: now,
    status: state.status,
    configuration: { activeScenarioId: state.activeScenarioId, selectedFleetPresetId: state.selectedFleetPresetId,
      elapsedSeconds: state.elapsedSeconds,
      injectedEvents: (state.injectedEvents || []).filter(item => item.injectedAt <= state.elapsedSeconds).map(item => ({ id: item.id, injectedAt: item.injectedAt })) },
  };
  if (!validateExerciseReview(review)) throw new Error('Pause a progressed exercise or complete it, then add a review title.');
  return review;
}

export function readExerciseArchive(storage) {
  try {
    const raw = storage.getItem(EXERCISE_ARCHIVE_KEY);
    if (raw === null) return { reviews: [], error: '' };
    if (raw.length > 200000) throw new Error('Archive too large');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_EXERCISE_REVIEWS || parsed.some(item => !validateExerciseReview(item))
      || new Set(parsed.map(item => item.id)).size !== parsed.length) throw new Error('Invalid archive');
    return { reviews: parsed, error: '' };
  } catch {
    return { reviews: [], error: 'Saved reviews could not be read. Existing browser data has not been overwritten. Download any open review before clearing the archive.' };
  }
}

export function writeExerciseArchive(storage, reviews, expectedReviews) {
  if (expectedReviews !== undefined) {
    const current = readExerciseArchive(storage);
    if (current.error || JSON.stringify(current.reviews) !== JSON.stringify(expectedReviews)) {
      throw new Error('Archive changed in another tab. Refresh archive before saving or deleting. Your draft is still in the form.');
    }
  }
  if (!Array.isArray(reviews) || reviews.length > MAX_EXERCISE_REVIEWS || reviews.some(item => !validateExerciseReview(item))
    || new Set(reviews.map(item => item.id)).size !== reviews.length) throw new Error('Invalid exercise archive');
  storage.setItem(EXERCISE_ARCHIVE_KEY, JSON.stringify(reviews));
}

export function exerciseComparison(current, baseline) {
  if (!validateExerciseReview(current) || !validateExerciseReview(baseline)) return { error: 'Select two valid saved reviews.' };
  if (current.id === baseline.id) return { error: 'Select a different baseline review.' };
  if (current.model !== baseline.model || current.configuration.activeScenarioId !== baseline.configuration.activeScenarioId
    || current.configuration.elapsedSeconds !== baseline.configuration.elapsedSeconds) {
    return { error: 'Compare the same scenario, model and elapsed simulation time. Different progress is not a fair comparison.' };
  }
  const a = current.scorecard;
  const b = baseline.scorecard;
  return { deltas: ['coverage', 'batteryReserve', 'riskReduced', 'detections'].map(key => ({ key, current: a[key], baseline: b[key], delta: a[key] - b[key] })) };
}

export function formatExerciseReview(review, baseline) {
  if (!validateExerciseReview(review)) throw new Error('Invalid exercise review');
  const frame = buildScenarioFrame(review.configuration);
  const lines = ['SKYDASH EXERCISE AFTER-ACTION REVIEW', EXERCISE_SCOPE, '',
    `Review: ${review.title}`, `Saved: ${new Date(review.savedAt).toISOString()}`, `Model: ${review.model}`,
    `Scenario: ${review.scenarioName}`, `Fleet: ${review.presetName}`, `State: ${review.status}; elapsed ${frame.elapsedSeconds}s / ${frame.scenario.durationSeconds}s`,
    `Model grade: ${review.scorecard.grade}; coverage ${review.scorecard.coverage}%; battery reserve ${review.scorecard.batteryReserve}%; risk-reduction score ${review.scorecard.riskReduced}%; detections ${review.scorecard.detections}`, '',
    'Reviewer notes (self-reported):', review.notes || '(none)', '', 'Injected conditions:',
    ...review.configuration.injectedEvents.map(item => `${item.injectedAt}s: ${INJECTION_EVENTS.find(inject => inject.id === item.id).label}`),
    ...(review.configuration.injectedEvents.length ? [] : ['(none)']), '', 'Model event timeline:',
    ...review.events.map(event => `${event.time}s: ${event.label}${event.injected ? ' [injected]' : ''}`),
  ];
  if (baseline) {
    const comparison = exerciseComparison(review, baseline);
    const baselineFrame = buildScenarioFrame(baseline.configuration);
    lines.push('', `Baseline: ${baseline.title}`, `Baseline configuration: ${baseline.scenarioName}; ${baseline.presetName}; elapsed ${baselineFrame.elapsedSeconds}s; conditions ${baseline.configuration.injectedEvents.map(item => `${item.id} at ${item.injectedAt}s`).join(', ') || 'none'}`, 'Comparison is descriptive, not a causal or operational assessment.');
    if (comparison.error) lines.push(comparison.error);
    else comparison.deltas.forEach(item => lines.push(`${item.key}: ${item.current} vs ${item.baseline}; delta ${item.delta >= 0 ? '+' : ''}${item.delta}${item.key === 'detections' ? '' : ' percentage points'}`));
  }
  return lines.join('\n');
}
