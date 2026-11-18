import { LOG_VERSION, LOG_SCOPE } from './flightLog';
export const QUALITY_VERSION = 'skydash-source-evidence-v1';
export const QUALITY_SCOPE = 'RECORDED EVIDENCE INVENTORY, NOT A SENSOR DIAGNOSIS OR FLIGHT GRADE. Counts describe only rows present in the supplied CSV. Missing cells do not identify an outage, and intervals do not reveal the expected logging rate or lost sample count. All time between rows is unsampled. Repeated positions may reflect a stationary aircraft or coordinate precision, not a fault. No continuous coverage, source authenticity or readiness is certified.';
export const QUALITY_CHANNELS = [
  { key: 'altitude_m', label: 'Source altitude' },
  { key: 'ground_speed_m_s', label: 'Ground speed' },
  { key: 'battery_pct', label: 'Battery' },
];
export function sourceEvidence(log) {
  if (!log || log.model_version !== LOG_VERSION || !Array.isArray(log.samples) || log.samples.length < 2) throw new Error('Load a supported recorded CSV source.');
  const samples = log.samples;
  const intervals = samples.slice(1).map((sample, index) => ({ from_index: index, to_index: index + 1, from_s: samples[index].time_s, to_s: sample.time_s, interval_s: sample.time_s - samples[index].time_s }));
  const sorted = intervals.map(item => item.interval_s).sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  const median_s = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const buckets = [{ label: 'Up to 1s', count: 0 }, { label: 'Over 1s to 5s', count: 0 }, { label: 'Over 5s', count: 0 }];
  for (const item of intervals) buckets[item.interval_s <= 1 ? 0 : item.interval_s <= 5 ? 1 : 2].count++;
  const gaps = intervals.filter(item => item.interval_s > 5);
  const channels = QUALITY_CHANNELS.map(channel => {
    const runs = []; let active = null, missing = 0;
    samples.forEach((sample, index) => {
      if (sample[channel.key] === null) {
        missing++;
        if (!active) { active = { from_index: index, to_index: index, from_s: sample.time_s, to_s: sample.time_s, count: 1 }; runs.push(active); }
        else { active.to_index = index; active.to_s = sample.time_s; active.count++; }
      } else active = null;
    });
    return { ...channel, known: samples.length - missing, missing, runs };
  });
  const repeated = []; let active = null;
  samples.slice(1).forEach((sample, index) => {
    const previous = samples[index];
    if (sample.latitude === previous.latitude && sample.longitude === previous.longitude) {
      if (!active) { active = { from_index: index, to_index: index + 1, from_s: previous.time_s, to_s: sample.time_s, count: 2 }; repeated.push(active); }
      else { active.to_index = index + 1; active.to_s = sample.time_s; active.count++; }
    } else active = null;
  });
  return { count: samples.length, duration_s: samples.at(-1).time_s, interval_count: intervals.length, min_interval_s: sorted[0], median_interval_s: median_s, max_interval_s: sorted.at(-1), buckets, gaps, channels, repeated };
}
export function sourceEvidenceReport(log) {
  const data = sourceEvidence(log);
  return ['SKYDASH / SOURCE EVIDENCE INVENTORY', QUALITY_SCOPE, LOG_SCOPE, '', `Inventory model: ${QUALITY_VERSION}`, `Replay model: ${LOG_VERSION}`, `Source: ${log.filename}`, `Exact-source SHA-256: ${log.sha256}`, `Rows: ${data.count}; elapsed source range: 0 to ${data.duration_s}s`, `Adjacent intervals: ${data.interval_count}; minimum ${data.min_interval_s}s; median ${data.median_interval_s}s; maximum ${data.max_interval_s}s`, 'Median uses the middle interval, or the mean of the two middle intervals. These are observed timestamp spacings, not a verified expected sensor rate.',
    ...data.buckets.map(bucket => `${bucket.label}: ${bucket.count} intervals`), '', 'INTERVALS OVER 5s (not a lost-sample count)',
    ...data.gaps.map(gap => `Rows ${gap.from_index + 1} to ${gap.to_index + 1}: ${gap.from_s}s to ${gap.to_s}s, ${gap.interval_s}s between observations`), ...(data.gaps.length ? [] : ['(none over 5s; shorter intervals are still unsampled)']), '',
    ...data.channels.flatMap(channel => [`${channel.label}: ${channel.known}/${data.count} known, ${channel.missing} missing cells; ${channel.runs.length} consecutive missing-row groups`, ...channel.runs.map(run => `Rows ${run.from_index + 1} to ${run.to_index + 1}, timestamps ${run.from_s}s to ${run.to_s}s: ${run.count} missing cells. Timestamp span is not outage duration.`), ...(channel.runs.length ? [] : ['(no missing cells in this channel)']), '']),
    'REPEATED CONSECUTIVE COORDINATE ROWS', ...data.repeated.map(run => `Rows ${run.from_index + 1} to ${run.to_index + 1}, timestamps ${run.from_s}s to ${run.to_s}s: ${run.count} identical coordinate rows. No motion or fault conclusion.`), ...(data.repeated.length ? [] : ['(none)']), '', 'No rows are repaired, resampled, interpolated or removed. Source altitude datum and aircraft identity remain unverified. Recompute with the exact CSV and listed models. The report contains source identity and timestamps, but no coordinates or private notes. Fingerprints detect source-byte differences, not tamper-evident custody. No server write, upload or sharing.'].join('\n');
}
