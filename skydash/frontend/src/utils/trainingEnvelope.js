import { ENVELOPE_GROUP_VERSION, ENVELOPE_GROUP_SCOPE, envelopeMatchGroupLines } from './envelopeMatchGroups';
import { LOG_VERSION, LOG_SCOPE } from './flightLog';
export const ENVELOPE_VERSION = 'skydash-training-envelope-v1';
export const ENVELOPE_SCOPE = 'OFFLINE SAMPLE REVIEW, NOT A FLIGHT SAFETY SYSTEM. Instructor-entered thresholds are discussion criteria, not manufacturer limits, airspace rules or flight authorization. Results classify recorded samples only. No interpolation, event duration, cause, pilot grade or full-flight compliance is inferred. Missing readings and unsampled intervals remain unknown. Altitude is the unverified source datum, not necessarily AGL.';
export const ENVELOPE_RULES = [
  { key: 'maxAltitude', field: 'altitude_m', label: 'Maximum source altitude', unit: 'm', min: -1000, max: 100000, direction: 'above' },
  { key: 'maxSpeed', field: 'ground_speed_m_s', label: 'Maximum ground speed', unit: 'm/s', min: 0, max: 500, direction: 'above' },
  { key: 'minBattery', field: 'battery_pct', label: 'Minimum battery', unit: '%', min: 0, max: 100, direction: 'below' },
];
export function validateEnvelope(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) || Object.keys(profile).some(key => !['name', 'maxAltitude', 'maxSpeed', 'minBattery'].includes(key))) throw new Error('Invalid envelope profile fields.');
  if (typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 120) throw new Error('Give this review profile a name, at most 120 characters.');
  let count = 0;
  for (const rule of ENVELOPE_RULES) {
    const value = profile[rule.key];
    if (value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max) throw new Error(`${rule.label} must be blank (disabled) or ${rule.min} to ${rule.max}${rule.unit}.`);
    count++;
  }
  if (!count) throw new Error('Enable at least one review threshold. Blank fields are disabled, not zero.');
  return { name: profile.name.trim(), ...Object.fromEntries(ENVELOPE_RULES.map(rule => [rule.key, profile[rule.key]])) };
}
export function evaluateEnvelope(log, input) {
  if (log.model_version !== LOG_VERSION) throw new Error('Unsupported source replay model.');
  const profile = validateEnvelope(input);
  const rules = ENVELOPE_RULES.map(rule => {
    const threshold = profile[rule.key];
    if (threshold === null) return { ...rule, state: 'disabled', threshold, known: 0, missing: 0, matches: [] };
    const matches = []; let known = 0, missing = 0;
    log.samples.forEach((sample, index) => {
      const value = sample[rule.field];
      if (value === null) { missing++; return; }
      known++;
      if (rule.direction === 'above' ? value > threshold : value < threshold) matches.push({ index, time_s: sample.time_s, value });
    });
    return { ...rule, threshold, known, missing, matches, state: matches.length ? 'review' : missing ? 'incomplete' : 'no-match' };
  });
  const gaps = log.samples.slice(1).flatMap((sample, index) => {
    const previous = log.samples[index], interval = sample.time_s - previous.time_s;
    return interval > 5 ? [{ from_s: previous.time_s, to_s: sample.time_s, interval_s: interval }] : [];
  });
  return { profile, rules, gaps, count: log.samples.length, duration_s: log.samples.at(-1).time_s };
}
export function envelopeProfileJSON(profile) {
  return { format: ENVELOPE_VERSION, profile: validateEnvelope(profile) };
}
export function readEnvelopeProfile(text) {
  if (typeof text !== 'string' || new Blob([text]).size > 8192) throw new Error('Review profile must be at most 8KiB.');
  let data; try { data = JSON.parse(text); } catch { throw new Error('Review profile is not valid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['format', 'profile'].includes(key)) || data.format !== ENVELOPE_VERSION) throw new Error('Unsupported review profile format.');
  return validateEnvelope(data.profile);
}
export function envelopeReport(log, profile, notes = '') {
  if (typeof notes !== 'string' || notes.length > 4000) throw new Error('Review notes are limited to 4,000 characters.');
  const result = evaluateEnvelope(log, profile);
  return ['SKYDASH / TRAINING ENVELOPE SAMPLE REVIEW', ENVELOPE_SCOPE, LOG_SCOPE, '', `Review model: ${ENVELOPE_VERSION}`, `Replay model: ${LOG_VERSION}`, `Profile: ${result.profile.name}`, `Source: ${log.filename}`, `Exact-source SHA-256: ${log.sha256}`, `Samples: ${result.count}; elapsed duration: ${result.duration_s}s`, `Intervals over 5s: ${result.gaps.length}. Unsampled time is not evaluated.`, '',
    ...result.rules.flatMap(rule => rule.state === 'disabled' ? [`${rule.label}: DISABLED`, ''] : [
      `${rule.label}: review values strictly ${rule.direction} ${rule.threshold}${rule.unit}; equality is not a match.`,
      `Evidence: ${rule.known}/${result.count} known, ${rule.missing} missing; ${rule.matches.length} matching samples. ${rule.state === 'incomplete' ? 'No matches among known readings, but missing evidence prevents a complete sample review.' : rule.state === 'no-match' ? 'No matching recorded samples, not proof of continuous compliance.' : 'Review these observations, no duration or cause inferred.'}`,
      ...rule.matches.map(item => `Sample ${item.index + 1} at ${item.time_s}s: ${item.value}${rule.unit}`), ''
    ]), 'UNSAMPLED INTERVALS OVER 5s', ...result.gaps.map(gap => `${gap.from_s}s to ${gap.to_s}s (${gap.interval_s}s between observations)`), result.gaps.length ? '' : '(none over 5s; shorter intervals are also unsampled)',
    '', 'ALL CONSECUTIVE MATCHING ROW GROUPS / EVERY CRITERION', ENVELOPE_GROUP_VERSION, ENVELOPE_GROUP_SCOPE, ...result.rules.flatMap(rule => [...envelopeMatchGroupLines(log.samples, rule), '']), '', 'INSTRUCTOR REVIEW NOTES (not sensor facts)', notes || '(none)', '', 'Keep the exact source CSV and exported profile JSON to reproduce this review. Profile names and thresholds are user-entered, not verified institutional policy. Reports and profiles are editable, not signed or tamper-evident. No automatic aircraft action, live alert, server storage or sharing. Review notes are session-only until downloaded.'].join('\n');
}
