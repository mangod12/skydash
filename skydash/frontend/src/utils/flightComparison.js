import { LOG_VERSION, LOG_SCOPE, summarizeFlight, sampleIndexAt } from './flightLog';
export const COMPARISON_VERSION = 'skydash-flight-comparison-v1';
export const COMPARISON_SCOPE = 'Two independent recorded logs aligned by elapsed time from each CSV start (0s), not UTC, takeoff or event synchronization. Different routes, aircraft, weather, sensor rates and altitude datums can make deltas incomparable. No pilot ranking, causal claim, certification or performance improvement is inferred. This comparison is session-only; download it and both sources to reproduce.';
export function recordedObservation(samples, time) {
  if (time < 0 || time > samples.at(-1).time_s) return { state: 'outside', sample: null, ageS: null, index: null };
  const index = sampleIndexAt(samples, time), sample = samples[index], next = samples[index + 1];
  return { state: next && next.time_s - sample.time_s > 5 && time > sample.time_s ? 'gap' : 'observed', sample, index, ageS: time - sample.time_s };
}
export function compareFlights(primary, baseline, time = 0) {
  if (primary.model_version !== LOG_VERSION || baseline.model_version !== LOG_VERSION) throw new Error('Both logs must use the current supported CSV replay model.');
  const a = summarizeFlight(primary.samples), b = summarizeFlight(baseline.samples);
  const left = recordedObservation(primary.samples, time), right = recordedObservation(baseline.samples, time);
  const delta = key => a[key] === null || b[key] === null ? null : a[key] - b[key];
  // Never compare a held gap observation, or a time outside either source.
  const channelDelta = key => left.state !== 'observed' || right.state !== 'observed' || left.sample[key] === null || right.sample[key] === null ? null : left.sample[key] - right.sample[key];
  return { primary: a, baseline: b, primaryObservation: left, baselineObservation: right,
    commonDurationS: Math.min(a.durationS, b.durationS), maxDurationS: Math.max(a.durationS, b.durationS), identicalSource: primary.sha256 === baseline.sha256,
    deltas: Object.fromEntries(['durationS', 'count', 'distanceM', 'gapCount', 'maxAltitudeM', 'maxSpeedMps', 'minBatteryPct'].map(key => [key, delta(key)])),
    currentDeltas: { altitude: channelDelta('altitude_m'), speed: channelDelta('ground_speed_m_s'), battery: channelDelta('battery_pct') } };
}
export const COMPARISON_METRICS = [
  { key: 'durationS', label: 'Whole-log duration', unit: 's' }, { key: 'count', label: 'Samples', unit: '' },
  { key: 'distanceM', label: 'Connected distance (gaps excluded)', unit: 'm' }, { key: 'gapCount', label: 'Gaps over 5s', unit: '' },
  { key: 'maxAltitudeM', label: 'Max altitude (unverified source datum)', unit: 'm' }, { key: 'maxSpeedMps', label: 'Max recorded ground speed', unit: 'm/s' },
  { key: 'minBatteryPct', label: 'Min recorded battery', unit: '%' },
];
export function comparisonReport(primary, baseline, notes = '') {
  const comparison = compareFlights(primary, baseline);
  const show = (value, unit) => value === null ? 'unknown' : `${value.toFixed(2)}${unit}`;
  const source = (log, label) => [`${label}: ${log.title}`, `Filename: ${log.filename}`, `SHA-256 of exact UTF-8 source: ${log.sha256}`, `Replay model: ${log.model_version}`, `Archive record: ${log.id || 'not saved, session-only'}`].join('\n');
  return ['SKYDASH / TWO-FLIGHT DEBRIEF COMPARISON', COMPARISON_VERSION, LOG_SCOPE, COMPARISON_SCOPE, '', source(primary, 'PRIMARY A'), '', source(baseline, 'BASELINE B'), '',
    comparison.identicalSource ? 'IDENTICAL SOURCE CHECKSUMS. This is the same source, not an independent flight comparison.' : 'Different source checksums do not prove different flights or authentic data.',
    `Shared elapsed-time range: 0 to ${comparison.commonDurationS}s. Whole-log summary metrics below are not trimmed to that range. Deltas are A minus B, not better/worse.`, '',
    ...COMPARISON_METRICS.map(({ key, label, unit }) => `${label}: A ${show(comparison.primary[key], unit)} | B ${show(comparison.baseline[key], unit)} | A-B ${show(comparison.deltas[key], unit)}`),
    `Altitude observations: A ${comparison.primary.altitudeCount}/${comparison.primary.count}, B ${comparison.baseline.altitudeCount}/${comparison.baseline.count}`,
    `Speed observations: A ${comparison.primary.speedCount}/${comparison.primary.count}, B ${comparison.baseline.speedCount}/${comparison.baseline.count}`,
    `Battery observations: A ${comparison.primary.batteryCount}/${comparison.primary.count}, B ${comparison.baseline.batteryCount}/${comparison.baseline.count}`, '', 'COMPARISON NOTES (analyst-authored, not sensor facts)', notes || '(none)', '',
    'Reproduce by importing both exact source CSVs with the listed model versions. Playback uses the last observation at or before elapsed time, never interpolation. Gaps over 5s suppress instantaneous deltas. Beyond a source end there is no observation. No automatic location/altitude datum normalization or battery-consumption model. Source fingerprints are not a tamper-evident chain of custody. CSV and report contain location data.'].join('\n');
}
