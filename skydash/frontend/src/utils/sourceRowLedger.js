import { LOG_VERSION } from './flightLog';
export const LEDGER_VERSION = 'skydash-source-row-ledger-v1';
export const LEDGER_FILTERS = [
  { key: 'all', label: 'All source rows' },
  { key: 'missing_any', label: 'Any optional channel missing' },
  { key: 'altitude_m', label: 'Source altitude missing' },
  { key: 'ground_speed_m_s', label: 'Ground speed missing' },
  { key: 'battery_pct', label: 'Battery missing' },
  { key: 'gap_end', label: 'First source row after interval over 5s' },
];
export const LEDGER_SCOPE = 'EXACT RECORDED ROW LEDGER, NOT CONTINUOUS TELEMETRY. Values are parsed numbers from the original source, not the literal CSV text. Original data-row numbers and elapsed times are retained. Unknown cells stay unknown. Filters do not crop, repair, sort or replace the source; adjacent displayed rows may not be adjacent source observations. Spacing always refers to the previous original source row. No outage, lost-sample, fault, safety or pilot-grade conclusion.';
export function sourceRowLedger(log, filter = 'all') {
  if (log?.model_version !== LOG_VERSION || !Array.isArray(log.samples) || log.samples.length < 2) throw new Error('Load a supported recorded source for the row ledger.');
  if (!LEDGER_FILTERS.some(item => item.key === filter)) throw new Error('Unsupported source row filter.');
  return log.samples.map((sample, index) => ({ row: index + 1, sample, spacing: index ? sample.time_s - log.samples[index - 1].time_s : null }))
    .filter(item => filter === 'all' || (filter === 'missing_any' ? ['altitude_m', 'ground_speed_m_s', 'battery_pct'].some(key => item.sample[key] === null) : filter === 'gap_end' ? item.spacing > 5 : item.sample[filter] === null));
}
export function locateSourceRow(log, input) {
  if (typeof input !== 'string' || !/^\d+$/.test(input) || Number(input) < 1 || Number(input) > log.samples.length) throw new Error('Choose an existing whole source data row starting at 1.');
  return Number(input) - 1;
}
export function nearestSourceTimeRow(log, input) {
  if (typeof input !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(input) || !Number.isFinite(Number(input)) || Number(input) < 0 || Number(input) > log.samples.at(-1).time_s) throw new Error('Choose seconds within this original source time range.');
  const time = Number(input); let low = 0, high = log.samples.length - 1;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (log.samples[mid].time_s < time) low = mid + 1; else high = mid; }
  return !low || time - log.samples[low - 1].time_s > log.samples[low].time_s - time ? low : low - 1;
}
export function sourceRowLedgerReport(log, filter) {
  const rows = sourceRowLedger(log, filter), group = LEDGER_FILTERS.find(item => item.key === filter);
  return ['SKYDASH / RECORDED SOURCE ROW LEDGER', LEDGER_VERSION, LEDGER_SCOPE, '', `Replay model: ${LOG_VERSION}`, `Source: ${log.filename}`, `Exact source SHA-256: ${log.sha256}`, `Filter: ${group.label} (${filter})`, `Matching rows: ${rows.length} of ${log.samples.length}; excluded rows: ${log.samples.length - rows.length}. All matching rows below, not only visible page.`, 'Spacing is from the previous ORIGINAL source row, including excluded rows. First source row has no prior spacing. Over 5s is a gap flag, not outage duration. All intervals are unsampled.', 'Source altitude datum unverified, ground speed is not airspeed, battery percentage is not energy/endurance.', '', 'data_row,time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct,previous_original_spacing_s,gap_over_5s (unknown = missing; none = no prior row)', ...rows.map(item => [item.row, item.sample.time_s, item.sample.latitude, item.sample.longitude, item.sample.altitude_m ?? 'unknown', item.sample.ground_speed_m_s ?? 'unknown', item.sample.battery_pct ?? 'unknown', item.spacing ?? 'none', item.spacing > 5 ? 'yes' : 'no'].join(',')), ...(rows.length ? [] : ['(no matching source rows)']), '', 'Human-readable evidence table, not importable CSV or a cropped source. Includes exact coordinates and source identity/times, but no private review notes. Keep original CSV for source bytes and reproducibility. Fingerprint detects byte changes, not authenticity or tamper-evident custody. Editable report, not signed evidence. No upload, automatic sharing or backend writes.'].join('\n');
}
