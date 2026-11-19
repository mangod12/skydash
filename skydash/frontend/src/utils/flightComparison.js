import { LOG_VERSION, LOG_SCOPE, summarizeFlight, sampleIndexAt } from './flightLog';
export const COMPARISON_VERSION = 'skydash-flight-comparison-v1';
export const COMPARISON_SCOPE = 'Two independent recorded logs. Default alignment uses each CSV start (0s), not UTC or takeoff synchronization. Optional manual sample anchors only associate reviewer-selected samples, not proven simultaneous events. Different routes, aircraft, weather, sensor rates and altitude datums can make deltas incomparable. No pilot ranking, causal claim, certification or performance improvement is inferred. This comparison is session-only; download it and both sources to reproduce.';
export function recordedObservation(samples, time) {
  if (time < 0 || time > samples.at(-1).time_s) return { state: 'outside', sample: null, ageS: null, index: null };
  const index = sampleIndexAt(samples, time), sample = samples[index], next = samples[index + 1];
  return { state: next && next.time_s - sample.time_s > 5 && time > sample.time_s ? 'gap' : 'observed', sample, index, ageS: time - sample.time_s };
}
export const ALIGNMENT_VERSION = 'skydash-comparison-anchors-v1';
export function comparisonAlignment(primary, baseline, alignment = null) {
  if (!alignment) return { primaryIndex: 0, baselineIndex: 0, primaryS: 0, baselineS: 0, label: '', manual: false };
  const { primaryIndex, baselineIndex, label } = alignment;
  if (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= primary.samples.length || !Number.isInteger(baselineIndex) || baselineIndex < 0 || baselineIndex >= baseline.samples.length || typeof label !== 'string' || !label.trim() || label.length > 200) throw new Error('Choose an existing sample row for each source and a review anchor label (1 to 200 characters).');
  return { primaryIndex, baselineIndex, primaryS: primary.samples[primaryIndex].time_s, baselineS: baseline.samples[baselineIndex].time_s, label, manual: true };
}
export function mappedComparisonSourceTime(samples, origin, reviewTime) {
  // An exact review-clock sample match must return its original numeric time.
  // No epsilon snapping: near timestamps remain separate review positions.
  let low = 0, high = samples.length - 1;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (samples[middle].time_s - origin < reviewTime) low = middle + 1; else high = middle; }
  return samples[low].time_s - origin === reviewTime ? samples[low].time_s : reviewTime + origin;
}
export function compareFlights(primary, baseline, time = 0, alignment = null) {
  if (primary.model_version !== LOG_VERSION || baseline.model_version !== LOG_VERSION) throw new Error('Both logs must use the current supported CSV replay model.');
  const a = summarizeFlight(primary.samples), b = summarizeFlight(baseline.samples);
  const anchor = comparisonAlignment(primary, baseline, alignment);
  const sourceTime = (samples, origin) => mappedComparisonSourceTime(samples, origin, time);
  const left = recordedObservation(primary.samples, sourceTime(primary.samples, anchor.primaryS)), right = recordedObservation(baseline.samples, sourceTime(baseline.samples, anchor.baselineS));
  const delta = key => a[key] === null || b[key] === null ? null : a[key] - b[key];
  // Never compare a held gap observation, or a time outside either source.
  const channelDelta = key => left.state !== 'observed' || right.state !== 'observed' || left.sample[key] === null || right.sample[key] === null ? null : left.sample[key] - right.sample[key];
  return { primary: a, baseline: b, alignment: anchor,
    startS: Math.min(-anchor.primaryS, -anchor.baselineS), endS: Math.max(a.durationS - anchor.primaryS, b.durationS - anchor.baselineS),
    commonStartS: Math.max(-anchor.primaryS, -anchor.baselineS), commonEndS: Math.min(a.durationS - anchor.primaryS, b.durationS - anchor.baselineS), primaryObservation: left, baselineObservation: right,
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
export function comparisonReport(primary, baseline, notes = '', alignment = null) {
  const comparison = compareFlights(primary, baseline, 0, alignment);
  const anchor = comparison.alignment;
  const show = (value, unit) => value === null ? 'unknown' : `${value.toFixed(2)}${unit}`;
  const source = (log, label) => [`${label}: ${log.title}`, `Filename: ${log.filename}`, `SHA-256 of exact UTF-8 source: ${log.sha256}`, `Replay model: ${log.model_version}`, `Archive record: ${log.id || 'not saved, session-only'}`].join('\n');
  return ['SKYDASH / TWO-FLIGHT DEBRIEF COMPARISON', COMPARISON_VERSION, LOG_SCOPE, COMPARISON_SCOPE, '', source(primary, 'PRIMARY A'), '', source(baseline, 'BASELINE B'), '',
    comparison.identicalSource ? 'IDENTICAL SOURCE CHECKSUMS. This is the same source, not an independent flight comparison.' : 'Different source checksums do not prove different flights or authentic data.',
    ALIGNMENT_VERSION, anchor.manual ? `MANUAL REVIEW ANCHORS: ${anchor.label}\nA CSV data row ${anchor.primaryIndex + 1} at ${anchor.primaryS}s; B CSV data row ${anchor.baselineIndex + 1} at ${anchor.baselineS}s.\nReview clock = source time minus that source anchor. Zero associates these chosen samples only, not verified same events or physical-time synchronization.` : 'DEFAULT ALIGNMENT: each CSV start at review clock zero, not UTC or takeoff synchronization.',
    `Shared review-clock range: ${comparison.commonStartS} to ${comparison.commonEndS}s. Whole-log summary metrics below are not trimmed to that range. Deltas are A minus B, not better/worse.`, '',
    ...COMPARISON_METRICS.map(({ key, label, unit }) => `${label}: A ${show(comparison.primary[key], unit)} | B ${show(comparison.baseline[key], unit)} | A-B ${show(comparison.deltas[key], unit)}`),
    `Altitude observations: A ${comparison.primary.altitudeCount}/${comparison.primary.count}, B ${comparison.baseline.altitudeCount}/${comparison.baseline.count}`,
    `Speed observations: A ${comparison.primary.speedCount}/${comparison.primary.count}, B ${comparison.baseline.speedCount}/${comparison.baseline.count}`,
    `Battery observations: A ${comparison.primary.batteryCount}/${comparison.primary.count}, B ${comparison.baseline.batteryCount}/${comparison.baseline.count}`, '', 'COMPARISON NOTES (analyst-authored, not sensor facts)', notes || '(none)', '',
    'Reproduce by importing both exact source CSVs with the listed model versions. Reapply the listed anchor sample rows and label if manual alignment was used. Playback uses the last observation at or before each mapped source time, never interpolation. Whole-log metrics never change with anchors. Gaps over 5s suppress instantaneous deltas. Beyond a source end there is no observation. No automatic location/altitude datum normalization or battery-consumption model. Source fingerprints are not a tamper-evident chain of custody. CSV and report contain location data.'].join('\n');
}
