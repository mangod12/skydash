import { LOG_HEADER, LOG_VERSION, MAX_LOG_BYTES, MAX_LOG_SAMPLES, parseFlightCSV, flightCSVHash } from './flightLog';
export const MAPPING_VERSION = 'skydash-csv-column-map-v1';
export const MAPPING_SCOPE = 'USER-CONFIGURED CSV CONVERSION. Column meanings, units, coordinate reference and altitude datum are not verified. No aircraft format is auto-detected or certified. Only numeric timestamps, WGS84 decimal-degree coordinates and explicitly selected channel units are supported. Row order is preserved; nothing is sorted, interpolated, repaired or silently skipped. Conversion does not authenticate the flight or make it safe to fly.';
export const MAPPING_FIELDS = [
  { key: 'time_s', label: 'Numeric time', required: true },
  { key: 'latitude', label: 'Latitude (WGS84 decimal degrees)', required: true },
  { key: 'longitude', label: 'Longitude (WGS84 decimal degrees)', required: true },
  { key: 'altitude_m', label: 'Altitude (unverified source datum)', required: false },
  { key: 'ground_speed_m_s', label: 'Ground speed', required: false },
  { key: 'battery_pct', label: 'Battery percentage', required: false },
];
const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
export function readMappingCSV(text) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_LOG_BYTES) throw new Error('Input CSV must be at most 1MiB.');
  // Deliberately bounded dialect: comma-separated, single-line rows; quoted cells allow escaped quotes and commas.
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  if (lines.length < 3 || lines.length > MAX_LOG_SAMPLES + 1) throw new Error('Provide one header and 2 to 10,000 data rows. No blank rows or multiline quoted cells.');
  const cellLine = (line, row) => {
    const cells = []; let value = '', quoted = false, closed = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') { value += '"'; index++; }
        else if (quoted) { quoted = false; closed = true; }
        else if (!value && !closed) quoted = true;
        else throw new Error(`Row ${row}: unsupported quote placement.`);
      } else if (char === ',' && !quoted) { cells.push(value); value = ''; closed = false; }
      else { if (closed || char === '\r') throw new Error(`Row ${row}: unsupported CSV quoting or line ending.`); value += char; }
    }
    if (quoted) throw new Error(`Row ${row}: unclosed quote or multiline cell.`);
    cells.push(value); return cells;
  };
  const headers = cellLine(lines[0], 1).map(value => value.trim());
  if (headers.length < 3 || headers.length > 64 || headers.some(value => !value || value.length > 120) || new Set(headers).size !== headers.length) throw new Error('Use 3 to 64 unique nonblank headers, up to 120 characters each.');
  const rows = lines.slice(1).map((line, index) => {
    const cells = cellLine(line, index + 2);
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2}: column count differs from header. No rows were skipped.`);
    return cells;
  });
  return { headers, rows };
}
export function validateColumnMapping(source, mapping) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).sort().join(',') !== ['columns', 'timeUnit', 'timeOrigin', 'altitudeUnit', 'speedUnit', 'coordinateReference'].sort().join(',')) throw new Error('Invalid mapping fields.');
  if (mapping.coordinateReference !== 'WGS84-decimal-degrees') throw new Error('Confirm source coordinates are WGS84 decimal degrees. No coordinate transformation is performed.');
  if (!['s', 'ms'].includes(mapping.timeUnit) || !['zero', 'subtract-first'].includes(mapping.timeOrigin) || !['m', 'ft'].includes(mapping.altitudeUnit) || !['m/s', 'km/h'].includes(mapping.speedUnit)) throw new Error('Choose supported units and time origin explicitly.');
  if (!mapping.columns || typeof mapping.columns !== 'object' || Array.isArray(mapping.columns) || Object.keys(mapping.columns).sort().join(',') !== MAPPING_FIELDS.map(field => field.key).sort().join(',')) throw new Error('Invalid mapped columns.');
  const used = new Set();
  for (const field of MAPPING_FIELDS) {
    const selected = mapping.columns[field.key];
    if (selected === null && !field.required) continue;
    if (!Number.isInteger(selected) || selected < 0 || selected >= source.headers.length || used.has(selected)) throw new Error('Map required columns and use each source column at most once. Unmapped optional channels stay unknown.');
    used.add(selected);
  }
  return mapping;
}
export async function convertMappedCSV(originalText, filename, input) {
  const source = readMappingCSV(originalText), mapping = validateColumnMapping(source, input);
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 120) throw new Error('Source filename must be present and at most 120 characters.');
  let firstTime;
  const converted = source.rows.map((cells, row) => MAPPING_FIELDS.map(field => {
    const column = mapping.columns[field.key];
    if (column === null) return '';
    const cell = cells[column].trim();
    if (!cell && !field.required) return '';
    if (!numeric.test(cell)) throw new Error(`Row ${row + 2}: mapped ${field.key} is not a finite numeric reading. No rows were skipped.`);
    let value = Number(cell);
    if (!Number.isFinite(value)) throw new Error(`Row ${row + 2}: mapped ${field.key} is not finite.`);
    if (field.key === 'time_s') {
      if (Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error(`Row ${row + 2}: timestamp exceeds safe numeric precision. Convert offline to bounded relative seconds first.`);
      value /= mapping.timeUnit === 'ms' ? 1000 : 1;
      if (row === 0) firstTime = value;
      if (mapping.timeOrigin === 'subtract-first') value -= firstTime;
    }
    if (field.key === 'altitude_m' && mapping.altitudeUnit === 'ft') value *= 0.3048;
    if (field.key === 'ground_speed_m_s' && mapping.speedUnit === 'km/h') value /= 3.6;
    return String(Object.is(value, -0) ? 0 : value);
  }).join(',')).join('\n');
  const csv_text = `${LOG_HEADER}\n${converted}\n`, samples = parseFlightCSV(csv_text);
  const original_sha256 = await flightCSVHash(originalText), sha256 = await flightCSVHash(csv_text);
  const recipe = { ...mapping, columns: { ...mapping.columns } };
  return { filename: filename.replace(/\.csv$/i, '').slice(0, 100) + '-mapped.csv', csv_text, sha256, samples, model_version: LOG_VERSION, original_filename: filename, original_sha256, original_bytes: new Blob([originalText]).size, mapping: recipe, headers: [...source.headers], first_time_s: firstTime };
}
export function mappingReport(result) {
  return ['SKYDASH / CSV COLUMN CONVERSION RECORD', MAPPING_SCOPE, '', `Conversion model: ${MAPPING_VERSION}`, `Target replay model: ${LOG_VERSION}`, `Original file: ${result.original_filename}`, `Original exact UTF-8 SHA-256: ${result.original_sha256}`, `Original UTF-8 bytes: ${result.original_bytes}`, `Converted file: ${result.filename}`, `Converted exact UTF-8 SHA-256: ${result.sha256}`, `Converted data rows: ${result.samples.length}`, `Time unit: ${result.mapping.timeUnit}; origin: ${result.mapping.timeOrigin}; first input time after unit conversion: ${result.first_time_s}s`, `Altitude unit: ${result.mapping.altitudeUnit}; speed unit: ${result.mapping.speedUnit}; battery: percentage0to100 only`, 'Conversion factors: milliseconds /1000; feet x0.3048; km/h /3.6. Unselected channels stay blank/unknown. Original values are not normalized for altitude datum.', '', ...MAPPING_FIELDS.map(field => `${field.key}: ${result.mapping.columns[field.key] === null ? 'UNMAPPED / unknown' : `source column ${result.mapping.columns[field.key] + 1} (${result.headers[result.mapping.columns[field.key]]})`}`), '', 'Preserve the original CSV, this conversion record and converted CSV together. The converted fingerprint is the replay/case source identity, not the original file fingerprint. Portable review case embeds the converted CSV only; it does not retain the original file or this recipe. Extra source columns are excluded. Reports contain source identifiers and headers, which may be sensitive. No upload, backend write or automatic sharing.'].join('\n');
}
