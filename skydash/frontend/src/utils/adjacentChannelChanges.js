import { LOG_VERSION } from './flightLog';
export const CHANGE_VERSION = 'skydash-adjacent-channel-change-v1';
export const CHANGE_CHANNELS = [
  { key: 'altitude_m', label: 'Source altitude', unit: 'm', deltaUnit: 'm', rateUnit: 'm/s' },
  { key: 'ground_speed_m_s', label: 'Ground speed', unit: 'm/s', deltaUnit: 'm/s', rateUnit: '(m/s)/s' },
  { key: 'battery_pct', label: 'Battery', unit: '%', deltaUnit: 'percentage points', rateUnit: 'percentage points/s' },
];
export const CHANGE_FILTERS = ['all', 'computed', 'unavailable'];
export const CHANGE_SCOPE = 'ADJACENT RECORDED-CELL ARITHMETIC, NOT VERIFIED AIRCRAFT DYNAMICS. Signed difference is later minus earlier original numeric cell; quotient divides that difference by original timestamp spacing. Not measured vertical speed, acceleration, energy consumption, sensor accuracy, an event threshold, pilot grade or flight readiness. Over-5s gaps or a missing endpoint make both calculations unavailable. No interpolation, bridging missing rows or claims about motion between observations.';
export function adjacentChannelChanges(log, key) {
  if (log?.model_version !== LOG_VERSION || !Array.isArray(log.samples) || log.samples.length < 2) throw new Error('Load a supported recorded CSV source.');
  const channel = CHANGE_CHANNELS.find(channel => channel.key === key);
  if (!channel) throw new Error('Select a supported optional channel.');
  const rows = log.samples.slice(1).map((later, index) => {
    const earlier = log.samples[index], spacing = later.time_s - earlier.time_s;
    const reasons = []; if (spacing > 5) reasons.push('gap over 5s'); if (earlier[key] === null) reasons.push('earlier cell missing'); if (later[key] === null) reasons.push('later cell missing');
    const delta = reasons.length ? null : later[key] - earlier[key];
    return { first: index + 1, last: index + 2, start: earlier.time_s, end: later.time_s, spacing, earlier: earlier[key], later: later[key], reasons, delta, quotient: delta === null ? null : delta / spacing };
  });
  const computed = rows.filter(row => row.delta !== null);
  const extreme = (field, direction) => computed.reduce((best, row) => best === null || direction * row[field] > direction * best[field] ? row : best, null);
  return { channel, rows, computed: computed.length, unavailable: rows.length - computed.length, gapCount: rows.filter(row => row.spacing > 5).length, missingCount: rows.filter(row => row.earlier === null || row.later === null).length, minDelta: extreme('delta', -1), maxDelta: extreme('delta', 1), minQuotient: extreme('quotient', -1), maxQuotient: extreme('quotient', 1) };
}
export function changeRows(data, filter) {
  if (!CHANGE_FILTERS.includes(filter)) throw new Error('Unsupported adjacent change filter.');
  return data.rows.filter(row => filter === 'all' || (filter === 'computed' ? row.delta !== null : row.delta === null));
}
export function adjacentChangeReport(log, key, filter = 'all') {
  const data = adjacentChannelChanges(log, key), rows = changeRows(data, filter), show = value => value === null ? 'unknown' : String(value);
  const extrema = (label, row, field, unit) => row ? `${label}: ${row[field]} ${unit}; original rows ${row.first} to ${row.last} at ${row.start}s to ${row.end}s.` : `${label}: unavailable, no computed adjacent pairs.`;
  return ['SKYDASH / ADJACENT CHANNEL CHANGE LEDGER', CHANGE_VERSION, CHANGE_SCOPE, `Replay model: ${LOG_VERSION}`, `Source: ${log.filename}; exact SHA-256 ${log.sha256}`, `Selected channel: ${data.channel.label}; source unit ${data.channel.unit}`, `${data.rows.length} adjacent original row pairs; ${data.computed} computed; ${data.unavailable} unavailable. Gap-blocked pairs ${data.gapCount}; missing-endpoint pairs ${data.missingCount}. These reasons overlap and are not additive. No pair skips an original row.`, 'Extrema below cover every computed original pair, independent of filter/page. Signed minima/maxima, not absolute magnitudes. Equal values keep the earliest original pair.', extrema('Minimum signed difference', data.minDelta, 'delta', data.channel.deltaUnit), extrema('Maximum signed difference', data.maxDelta, 'delta', data.channel.deltaUnit), extrema('Minimum signed quotient', data.minQuotient, 'quotient', data.channel.rateUnit), extrema('Maximum signed quotient', data.maxQuotient, 'quotient', data.channel.rateUnit), `Filter: ${filter}; all ${rows.length}/${data.rows.length} matching pairs in original order, not only this page.`, '', ...rows.flatMap(row => [`Original rows ${row.first} to ${row.last}; ${row.start}s to ${row.end}s; spacing ${row.spacing}s.`, `Earlier ${show(row.earlier)}; later ${show(row.later)} (${data.channel.unit}; unknown has no unit).`, row.delta === null ? `Difference and quotient unavailable: ${row.reasons.join('; ')}.` : `Signed difference ${row.delta} ${data.channel.deltaUnit}; signed quotient ${row.quotient} ${data.channel.rateUnit}.`, '']), ...(rows.length ? [] : ['No matching pairs, not proof of source completeness or aircraft stability.']), 'Exactly 5s can be computed only when both endpoints are known. Every interval remains unsampled. Battery change uses percentage points, not relative percent or energy. Source altitude datum unverified; ground speed not airspeed. No coordinates or private notes included, but source identity/times/channel readings can be sensitive. Keep exact CSV/channel/filter/models to reproduce. Editable, not authenticated or tamper-evident. Derived session-only panel, excluded from cases/comparison/notebooks/library; download separately. No source edits, interpolation, upload, backend writes, automatic persistence/sharing, alerts or aircraft commands.'].join('\n');
}
