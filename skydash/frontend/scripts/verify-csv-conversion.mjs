#!/usr/bin/env node
// Reproduce the numeric conversion using this checkout, never code from the three inputs.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function input(filename, limit) {
  const path = resolve(filename), info = await stat(path);
  if (!info.isFile() || info.size > limit) throw new Error('Input must be a bounded regular file.');
  const bytes = await readFile(path); if (bytes.length > limit) throw new Error('Input exceeds byte limit.');
  return { bytes, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
}
async function validator() {
  const output = await build({ configFile: false, root, logLevel: 'silent', build: { ssr: resolve(root, 'src/utils/conversionReproduction.js'), write: false, minify: false, sourcemap: false } });
  const chunks = output.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('Expected one offline validator module.');
  return import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64'));
}
export async function verifyCSVConversion(originalPath, recipePath, convertedPath, { confirmedWGS84 = false } = {}) {
  if (confirmedWGS84 !== true) throw new Error('A fresh explicit source-coordinate confirmation is required for each reproduction.');
  const original = await input(originalPath, 1024 * 1024), recipe = await input(recipePath, 65536), converted = await input(convertedPath, 1024 * 1024);
  const api = await validator(), reproduced = await api.reproduceCSVConversion(original.text, recipe.text, converted.bytes, { confirmedWGS84 });
  return { format: 'skydash-csv-conversion-reproduction-v1', exact_original_sha256: original.sha256, exact_recipe_sha256: recipe.sha256, exact_converted_sha256: converted.sha256, ...reproduced,
    scope: 'All three caller-selected files read locally and bounded. Exact converted bytes regenerated with this checkout from every original row and the validated exact-header/order mapping recipe; no sorting, interpolation, repair or silent row skipping. This relation check is not an external expected-digest check, authenticity, verified source units/datum/coordinates, aircraft/vendor compatibility, authenticated authorship, custody, flight identity, grade or readiness. Fresh coordinate confirmation is a caller statement, not independent verification; recipes cannot supply it. Original extra columns are excluded by the explicit mapping; absolute numeric time may be subtracted by its configured origin. Exact hashes can identify sensitive work. No filenames, header names, recipe labels, coordinates, individual readings, original absolute timestamps or private text printed. No report or converted file written; no upload, storage, sharing, network or aircraft commands. Preserve original, recipe, converted CSV and separate conversion record; portable review bundles still embed only converted CSV.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/verify-csv-conversion.mjs ORIGINAL.csv RECIPE.json CONVERTED.csv --confirm-wgs84\nRead-only reproduction using actual numeric adapter/recipe validators. Confirm source coordinates are WGS84 decimal degrees anew on each run. Original/converted1MiB each; recipe64KiB; strict UTF-8 regular files. Exact regenerated converted bytes must match, including formatting. No writes, repair, private values or automatic external expected-digest check. No authenticity/vendor compatibility/readiness claim.');
  else if (args.length !== 4 || args[3] !== '--confirm-wgs84' || args.slice(0, 3).some(arg => arg.startsWith('-'))) { console.error('Expected original CSV, recipe JSON, converted CSV and fresh --confirm-wgs84. Use --help.'); process.exitCode = 1; }
  else verifyCSVConversion(args[0], args[1], args[2], { confirmedWGS84: true }).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('CSV conversion reproduction failed. No receipt or files written. Check bounded regular UTF-8 files, exact recipe header/order/models, fresh source-coordinate confirmation, explicit numeric mapping/units and exact regenerated converted bytes. Private inputs are not echoed.'); process.exitCode = 1; });
}
