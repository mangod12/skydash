/** Numeric single-aircraft CSV contract. No aircraft commands or scenario scores. */
export const LOG_VERSION = 'skydash-flight-csv-v1';
export const LOG_HEADER = 'time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct';
export const MAX_LOG_BYTES = 1024 * 1024;
export const MAX_LOG_SAMPLES = 10000;
export const LOG_SCOPE = 'RECORDED-LOG TRAINING REVIEW ONLY. User-supplied observations, not a verified aircraft feed, flight clearance or training certification. No aircraft commands. Gaps over 5s break the track; playback holds the last observation, never interpolates. Distances exclude gaps and are not actual flown distance. Altitude uses the source datum, which SkyDash does not verify.';
export const SAMPLE_LOG = `${LOG_HEADER}\n0,28.61390,77.20900,10,0,95\n2,28.61400,77.20910,20,5,94\n4,28.61410,77.20920,30,6,93\n12,28.61420,77.20930,,5,\n14,28.61430,77.20940,35,4,91\n16,28.61440,77.20950,25,0,90\n`;
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const fields = LOG_HEADER.split(',');
const limits = [[0, 21600], [-85, 85], [-180, 180], [-1000, 100000], [0, 500], [0, 100]];
export function parseFlightCSV(text) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_LOG_BYTES) throw new Error('CSV must be at most 1MiB.');
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines[0]?.trim() !== LOG_HEADER) throw new Error(`Expected exact header: ${LOG_HEADER}. Binary MAVLink/ULog and other CSV schemas are not supported.`);
  if (lines.length < 3 || lines.length > MAX_LOG_SAMPLES + 1) throw new Error('Provide 2 to 10,000 samples with no blank rows.');
  const samples = lines.slice(1).map((line, row) => {
    const cells = line.split(',').map(cell => cell.trim());
    if (cells.length !== fields.length) throw new Error(`Row ${row + 2}: expected six numeric columns, no quoted cells.`);
    const values = cells.map((cell, column) => {
      if (!cell && column >= 3) return null;
      const value = numberPattern.test(cell) ? Number(cell) : NaN;
      const [min, max] = limits[column];
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Row ${row + 2}: invalid ${fields[column]} (${min} to ${max}).`);
      return value;
    });
    return Object.fromEntries(fields.map((key, index) => [key, values[index]]));
  });
  if (samples[0].time_s !== 0) throw new Error('First time_s must be 0, relative seconds, not an epoch timestamp.');
  for (let index = 1; index < samples.length; index++) {
    if (samples[index].time_s <= samples[index - 1].time_s) throw new Error(`Row ${index + 2}: time_s must strictly increase. Samples are not sorted or deduplicated silently.`);
    if (Math.abs(samples[index].longitude - samples[index - 1].longitude) > 180) throw new Error('Tracks crossing the dateline are not supported.');
  }
  return samples;
}
export async function flightCSVHash(text) {
  const bytes = new globalThis.TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function sampleIndexAt(samples, time) {
  let low = 0, high = samples.length - 1;
  while (low < high) { const middle = Math.ceil((low + high) / 2); if (samples[middle].time_s <= time) low = middle; else high = middle - 1; }
  return low;
}
function metres(a, b) {
  const rad = n => n * Math.PI / 180;
  const value = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}
export function summarizeFlight(samples) {
  let distanceM = 0, largestGapS = 0, gapCount = 0;
  const segments = [[samples[0]]];
  for (let index = 1; index < samples.length; index++) {
    const gap = samples[index].time_s - samples[index - 1].time_s;
    largestGapS = Math.max(largestGapS, gap);
    if (gap > 5) { gapCount++; segments.push([]); } else distanceM += metres(samples[index - 1], samples[index]);
    segments.at(-1).push(samples[index]);
  }
  const measured = key => samples.map(sample => sample[key]).filter(value => value !== null);
  const altitudes = measured('altitude_m'), speeds = measured('ground_speed_m_s'), batteries = measured('battery_pct');
  return { durationS: samples.at(-1).time_s, count: samples.length, distanceM, gapCount, largestGapS, segments,
    maxAltitudeM: altitudes.length ? Math.max(...altitudes) : null, maxSpeedMps: speeds.length ? Math.max(...speeds) : null, minBatteryPct: batteries.length ? Math.min(...batteries) : null,
    altitudeCount: altitudes.length, speedCount: speeds.length, batteryCount: batteries.length };
}
export function flightAfterAction(log) {
  const summary = summarizeFlight(log.samples);
  const show = value => value === null ? 'unknown' : value.toFixed(2);
  return ['SKYDASH / RECORDED-LOG AFTER-ACTION REPORT', LOG_SCOPE, '', `Parser / replay model: ${LOG_VERSION}`, `Title: ${log.title}`, `Source: ${log.filename}`, `SHA-256 of exact UTF-8 source: ${log.sha256}`, `Server record: ${log.id || 'not saved (session-only preview)'}`, `Saved at: ${log.created_at || 'not saved'}`,
    '', `Samples: ${summary.count}`, `Duration: ${summary.durationS}s`, `Observed connected-segment distance: ${summary.distanceM.toFixed(2)}m`, `Gaps over 5s: ${summary.gapCount}`, `Largest interval: ${summary.largestGapS}s`,
    `Max altitude (source datum): ${show(summary.maxAltitudeM)}m (${summary.altitudeCount}/${summary.count} observations)`, `Max recorded ground speed: ${show(summary.maxSpeedMps)}m/s (${summary.speedCount}/${summary.count} observations)`, `Min recorded battery: ${show(summary.minBatteryPct)}% (${summary.batteryCount}/${summary.count} observations)`,
    '', 'ANALYST NOTES (not sensor observations)', log.notes || '(none)', '', 'No scenario scores, pass/fail grades, event causes, full-flight completeness or data authenticity are inferred. To reproduce, reopen this server record or re-import the exact source CSV using this model version. Server persistence requires a retained SQLite database volume and backups. Reports and CSV contain location data.'].join('\n');
}
