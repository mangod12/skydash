import { LOG_VERSION } from './flightLog';
export const CHANNEL_CHART_VERSION = 'skydash-channel-chart-v1';
export const CHART_CHANNELS = [
  { key: 'altitude_m', label: 'Source altitude', unit: 'm', caveat: 'Unverified source altitude datum, not necessarily AGL.' },
  { key: 'ground_speed_m_s', label: 'Ground speed', unit: 'm/s', caveat: 'Recorded source ground speed, not airspeed.' },
  { key: 'battery_pct', label: 'Battery', unit: '%', caveat: 'Recorded battery percentage, not energy consumption or endurance.' },
];
export const CHART_SCOPE = 'RECORDED SAMPLE PLOT, NOT CONTINUOUS TELEMETRY. Every known source value is plotted without smoothing or downsampling. Thin connecting lines are visual guides between adjacent known rows at most 5s apart, not observations between them. Longer intervals and missing rows break lines. Unknowns are never zero. Click chooses the nearest recorded timestamp, ties choose the earlier row, not a detected event. No causal, safety, grading or completeness claims.';
export function channelChart(log, channel) {
  if (log?.model_version !== LOG_VERSION || !CHART_CHANNELS.some(item => item.key === channel)) throw new Error('Unsupported recorded chart model or channel.');
  const known = log.samples.map((sample, index) => ({ index, time: sample.time_s, value: sample[channel] })).filter(item => item.value !== null);
  const values = known.map(item => item.value), min = values.length ? Math.min(...values) : null, max = values.length ? Math.max(...values) : null;
  const range = min === max ? Math.max(Math.abs(min) * 0.05, 1) : max - min;
  const low = min === null ? 0 : min === max ? min - range : min, high = max === null ? 1 : min === max ? max + range : max;
  const duration = log.samples.at(-1).time_s;
  const x = time => 55 + (time / duration) * 730, y = value => 225 - (value - low) / (high - low) * 190;
  const segments = []; let current = [];
  for (let index = 0; index < log.samples.length; index++) {
    const sample = log.samples[index];
    if (sample[channel] === null) { if (current.length) segments.push(current); current = []; continue; }
    if (current.length && sample.time_s - log.samples[index - 1].time_s > 5) { segments.push(current); current = []; }
    current.push({ index, time: sample.time_s, value: sample[channel], x: x(sample.time_s), y: y(sample[channel]) });
  }
  if (current.length) segments.push(current);
  return { channel, min, max, low, high, duration, count: known.length, missing: log.samples.length - known.length,
    linePath: segments.filter(segment => segment.length > 1).map(segment => segment.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ')).join(' '),
    pointPath: segments.flat().map(point => `M${point.x - 1.5},${point.y}h3`).join(' '),
    segments, x, y };
}
export function nearestChartSample(samples, time) {
  if (!Number.isFinite(time)) throw new Error('Chart seek time must be finite.');
  let low = 0, high = samples.length - 1;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (samples[middle].time_s < time) low = middle + 1; else high = middle; }
  if (!low) return 0;
  return time - samples[low - 1].time_s <= samples[low].time_s - time ? low - 1 : low;
}
export function channelChartReport(log, channel) {
  const chart = channelChart(log, channel), metadata = CHART_CHANNELS.find(item => item.key === channel);
  return ['SKYDASH / RECORDED CHANNEL PLOT EVIDENCE', CHANNEL_CHART_VERSION, CHART_SCOPE, metadata.caveat, '', `Replay model: ${LOG_VERSION}`, `Source: ${log.filename}`, `Exact source SHA-256: ${log.sha256}`, `Channel: ${metadata.label} (${metadata.unit})`, `Known ${chart.count}/${log.samples.length}; missing ${chart.missing}.`, `Observed minimum: ${chart.min ?? 'unknown'}; observed maximum: ${chart.max ?? 'unknown'}. Axis is automatic, not a safe operating range.`, '', 'ALL SOURCE ROWS, INCLUDING UNKNOWN VALUES', 'data_row,time_s,value (unknown = missing)', ...log.samples.map((sample,index)=>`${index+1},${sample.time_s},${sample[channel] ?? 'unknown'}`), '', 'Keep exact primary CSV to reproduce this plot. Every known source point is retained; no interpolation, averaging, smoothing or lost-sample inference. The report omits coordinates but source identity/timestamps can be sensitive. Human-readable, editable, not signed evidence. No automatic upload, sharing or server writes.'].join('\n');
}
