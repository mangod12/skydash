import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserConversionReproduction } from './browserConversionReproduction';
import { convertMappedCSV, readMappingCSV } from './csvColumnMapping';
import { exportMappingRecipe } from './mappingRecipe';
import { verifyCSVConversion } from '../../scripts/verify-csv-conversion.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = (name, text) => { const bytes = Buffer.from(text); return { name, size: bytes.length, arrayBuffer: vi.fn(async () => bytes) }; };
let files, raw, recipe, converted, mapping, dir;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-browser-convert-'));
  raw = '\ufeffclock,lat,lon,height,speed,battery,PRIVATE-extra\r\n1000,28.6,77.2,100,36,95,PRIVATE-value\r\n3000,28.61,77.21,,0,0,PRIVATE-second\r\n';
  mapping = { columns: { time_s: 0, latitude: 1, longitude: 2, altitude_m: 3, ground_speed_m_s: 4, battery_pct: 5 }, timeUnit: 'ms', timeOrigin: 'subtract-first', altitudeUnit: 'ft', speedUnit: 'km/h', coordinateReference: 'WGS84-decimal-degrees' };
  recipe = exportMappingRecipe(readMappingCSV(raw).headers, mapping, 'PRIVATE label'); converted = await convertMappedCSV(raw, 'PRIVATE.csv', mapping);
  files = { original: file('PRIVATE.csv', raw), recipe: file('PRIVATE.json', recipe), converted: file('PRIVATE-converted.csv', converted.csv_text) };
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('reproduces exact original/recipe/converted with BOM/CRLF, units, zeros and blanks; receipt evidence equals CLI and excludes private fields', async () => {
  const expected = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([role, f]) => [role, hash(await f.arrayBuffer()).toUpperCase()])));
  const previous = globalThis.Buffer; let data; try { globalThis.Buffer = undefined; data = await browserConversionReproduction(files, { confirmedWGS84: true, expected }); } finally { globalThis.Buffer = previous; }
  for (const [role, f] of Object.entries(files)) await writeFile(join(dir, role), await f.arrayBuffer());
  const cli = await verifyCSVConversion(join(dir, 'original'), join(dir, 'recipe'), join(dir, 'converted'), { confirmedWGS84: true });
  for (const key of ['exact_original_sha256','exact_recipe_sha256','exact_converted_sha256','exact_converted_bytes_reproduced','conversion_model','recipe_format','replay_model','source_coordinate_confirmation_supplied','converted_samples']) expect(data[key]).toEqual(cli[key]);
  expect(data.expected_raw_digests_matched).toEqual({ original: true, recipe: true, converted: true });
  for (const secret of ['PRIVATE','28.6','77.2','30.48']) expect(JSON.stringify(data)).not.toContain(secret);
});
it('requires strict fresh confirmation before reads, role bounds and syntactically valid raw pins before any file read', async () => {
  for (const confirmedWGS84 of [undefined, false, 1, 'true']) await expect(browserConversionReproduction(files, { confirmedWGS84 })).rejects.toThrow('Fresh');
  for (const role of Object.keys(files)) { const limit = role === 'recipe' ? 65536 : 1048576; for (const size of [0, -1, 1.5, limit+1]) await expect(browserConversionReproduction({ ...files, [role]: { ...files[role], size } }, { confirmedWGS84: true })).rejects.toThrow('Bounded'); }
  await expect(browserConversionReproduction(files, { confirmedWGS84: true, expected: { converted: 'bad' } })).rejects.toThrow('Bounded');
  for (const f of Object.values(files)) expect(f.arrayBuffer).not.toHaveBeenCalled();
});
it('checks every supplied raw pin before parsing or conversion and does not count internal agreement as independent expectation', async () => {
  const bad = { ...files, original: file('PRIVATE.csv', 'PRIVATE invalid') };
  for (const role of ['original','recipe','converted']) await expect(browserConversionReproduction(bad, { confirmedWGS84: true, expected: { [role]: 'a'.repeat(64) } })).rejects.toThrow('expectation mismatch');
  const data = await browserConversionReproduction(files, { confirmedWGS84: true, expected: { recipe: hash(recipe) } }); expect(data.expected_raw_digests_matched).toEqual({ original: false, recipe: true, converted: false });
});
it.each(['changed-converted','formatting','wrong-model','header-order','unknown-units','bad-source','utf8','recipe-confirmation','changed-size'])('refuses %s without an emitted success', async kind => {
  if (kind === 'changed-converted') files.converted = file('PRIVATE.csv', converted.csv_text.replace('30.48','30.49'));
  if (kind === 'formatting') files.converted = file('PRIVATE.csv', converted.csv_text+'\n');
  if (kind === 'wrong-model') files.recipe = file('PRIVATE.json', recipe.replace('skydash-csv-column-map-v1','future'));
  if (kind === 'header-order') files.original = file('PRIVATE.csv', raw.replace('clock,lat,lon','clock,lon,lat'));
  if (kind === 'unknown-units') files.recipe = file('PRIVATE.json', recipe.replace('"timeUnit": "ms"','"timeUnit": "unknown"'));
  if (kind === 'bad-source') files.original = file('PRIVATE.csv', raw.replace('3000,28.61','1000,28.61'));
  if (kind === 'utf8') files.original = file('PRIVATE.csv', Buffer.from([255]));
  if (kind === 'recipe-confirmation') { const x = JSON.parse(recipe); x.configuration.coordinateReference = 'WGS84-decimal-degrees'; files.recipe = file('PRIVATE.json', JSON.stringify(x)); }
  if (kind === 'changed-size') files.recipe = { ...files.recipe, size: 1 };
  await expect(browserConversionReproduction(files, { confirmedWGS84: true })).rejects.toThrow();
});
it('accepts explicitly unmapped optional channels as unknown, not zero, and binds changed recipe whitespace separately', async () => {
  mapping.columns.altitude_m = null; mapping.columns.ground_speed_m_s = null; mapping.columns.battery_pct = null;
  const output = await convertMappedCSV(raw, 'PRIVATE.csv', mapping), recipeText = exportMappingRecipe(readMappingCSV(raw).headers, mapping, 'PRIVATE')+'\n';
  const result = await browserConversionReproduction({ ...files, recipe: file('PRIVATE.json', recipeText), converted: file('PRIVATE.csv', output.csv_text) }, { confirmedWGS84: true });
  expect(result.exact_recipe_sha256).toBe(hash(recipeText)); expect(result.exact_converted_sha256).toBe(output.sha256); expect(output.samples[0].altitude_m).toBeNull(); expect(output.samples[0].ground_speed_m_s).toBeNull(); expect(output.samples[0].battery_pct).toBeNull();
});
