import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { LOG_VERSION, LOG_HEADER, parseFlightCSV } from './flightLog';
import { MAPPING_VERSION, readMappingCSV, validateColumnMapping, convertMappedCSV, mappingReport } from './csvColumnMapping';
const csv = 'clock,lat,lon,height_ft,speed_kmh,battery,ignored\n1000,28.6,77.2,100,36,95,other\n3000,28.61,77.21,,18,,extra\n';
const mapping = { columns: { time_s: 0, latitude: 1, longitude: 2, altitude_m: 3, ground_speed_m_s: 4, battery_pct: 5 }, timeUnit: 'ms', timeOrigin: 'subtract-first', altitudeUnit: 'ft', speedUnit: 'km/h', coordinateReference: 'WGS84-decimal-degrees' };
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
describe('bounded numeric CSV column mapping', () => {
  it('reads quoted header commas and escaped quotes without evaluating unselected content', () => {
    const source = readMappingCSV('clock,lat,lon,"extra, text",name\r\n0,0,0,"hello, world","a""b"\r\n1,1,1,=bad,unchanged\r\n'); expect(source.headers[3]).toBe('extra, text'); expect(source.rows[0][4]).toBe('a"b'); expect(source.rows[1][3]).toBe('=bad');
  });
  it.each(['a,b,c\n0,0,0\n', 'a,a,c\n0,0,0\n1,1,1', 'a,,c\n0,0,0\n1,1,1', 'a,b,c\n0,0\n1,1,1', 'a,b,c\n"0,0,0\n1,1,1', 'a,b,c\n0"x,0,0\n1,1,1', 'a,b,c\n"0"x,0,0\n1,1,1', 'a,b,c\n0,0,0\n\n1,1,1', 'a;b;c\n0;0;0\n1;1;1', 'x'.repeat(1048577)])('rejects unsupported shape or dialect', text => expect(() => readMappingCSV(text)).toThrow());
  it('converts units and origin explicitly, preserves row order and missing optional values', async () => {
    const result = await convertMappedCSV(csv, 'input.csv', mapping); expect(result.samples[0]).toEqual({ time_s: 0, latitude: 28.6, longitude: 77.2, altitude_m: 30.48, ground_speed_m_s: 10, battery_pct: 95 }); expect(result.samples[1]).toEqual({ time_s: 2, latitude: 28.61, longitude: 77.21, altitude_m: null, ground_speed_m_s: 5, battery_pct: null }); expect(result.csv_text).toContain(LOG_HEADER); expect(parseFlightCSV(result.csv_text)).toEqual(result.samples); expect(result.model_version).toBe(LOG_VERSION); expect(result.original_sha256).not.toBe(result.sha256); expect(result.filename).toBe('input-mapped.csv'); expect(result.csv_text).not.toContain('extra');
  });
  it('keeps zeros known and optional unmapped channels unknown, without guessed columns', async () => {
    const custom = { ...mapping, columns: { ...mapping.columns, altitude_m: null, ground_speed_m_s: null, battery_pct: null }, timeUnit: 's', timeOrigin: 'zero' }; const result = await convertMappedCSV('t,y,x\n0,0,0\n1,0,0\n', 'zero.csv', custom); expect(result.samples[0].latitude).toBe(0); expect(result.samples[0].altitude_m).toBeNull(); expect(result.samples[0].battery_pct).toBeNull(); expect(result.csv_text).toContain('0,0,0,,,');
  });
  it.each([
    change => { change.coordinateReference = ''; }, change => { change.timeUnit = 'microseconds'; }, change => { change.timeOrigin = 'guess'; }, change => { change.altitudeUnit = 'AGL'; }, change => { change.speedUnit = 'knots'; }, change => { change.columns.time_s = null; }, change => { change.columns.latitude = 0; }, change => { change.columns.battery_pct = 99; }, change => { change.columns.altitude_m = '3'; }, change => { change.columns.command = 6; }, change => { delete change.columns.longitude; }, change => { change.approved = true; },
  ])('requires exact mapping, unique columns and supported coordinate/units', mutate => { const copy = structuredClone(mapping); mutate(copy); expect(() => validateColumnMapping(readMappingCSV(csv), copy)).toThrow(); });
  it.each([
    ['unsafe time precision', csv.replace('1000,', '9007199254740992,')],
    ['descending', 'clock,lat,lon,height_ft,speed_kmh,battery,ignored\n3000,0,0,1,1,1,x\n1000,0,0,1,1,1,x\n'],
    ['duplicate', csv.replace('3000', '1000')], ['invalid numeric', csv.replace('100,36', 'bad,36')], ['nonfinite', csv.replace('100,36', '1e999,36')], ['latitude', csv.replace('28.61', '86')], ['battery', csv.replace(',95,', ',101,')], ['negative speed', csv.replace(',36,', ',-36,')], ['missing required', csv.replace('1000,28.6', ',28.6')], ['time range', csv.replace('3000', '21602000')],
  ])('rejects invalid mapped rows instead of repairing or skipping: %s', async (_name, text) => { await expect(convertMappedCSV(text, 'bad.csv', mapping)).rejects.toThrow(); });
  it('requires first-zero under zero-origin mode and never silently subtracts it', async () => { await expect(convertMappedCSV(csv, 'input.csv', { ...mapping, timeOrigin: 'zero' })).rejects.toThrow('First time_s'); });
  it('hashes exact original UTF-8 including BOM and CRLF', async () => {
    const original = '\uFEFF' + csv.replaceAll('\n', '\r\n'); const result = await convertMappedCSV(original, 'source.csv', mapping); expect(result.samples).toHaveLength(2); const plain = await convertMappedCSV(csv, 'source.csv', mapping); expect(result.original_sha256).not.toBe(plain.original_sha256); expect(result.sha256).toBe(plain.sha256);
  });
  it('snapshots the mapping instead of retaining mutable caller data', async () => { const copy = structuredClone(mapping), result = await convertMappedCSV(csv, 'source.csv', copy); copy.columns.latitude = 6; expect(result.mapping.columns.latitude).toBe(1); });
  it('exports original/converted identity, exact recipe, factors and explicit lineage limits', async () => {
    const result = await convertMappedCSV(csv, 'source.csv', mapping), report = mappingReport(result); for (const value of [MAPPING_VERSION, LOG_VERSION, result.original_sha256, result.sha256, 'source column 4 (height_ft)', 'milliseconds /1000', 'feet x0.3048', 'km/h /3.6', 'converted CSV only', 'not the original file fingerprint', 'Extra source columns are excluded']) expect(report).toContain(value);
  });
});
