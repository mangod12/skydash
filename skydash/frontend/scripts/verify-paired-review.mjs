#!/usr/bin/env node
// Offline reader only. Validation code comes from this checkout, never from the input file.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 4 * 1024 * 1024;
export async function loadPairedValidator() {
  const output = await build({ configFile: false, root, logLevel: 'silent', build: { ssr: resolve(root, 'src/utils/pairedReviewBundle.js'), write: false, minify: false, sourcemap: false } });
  const chunks = output.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('Expected a single offline validation module.');
  return import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64'));
}
export async function verifyPairedFile(filename, { reportPath = null } = {}) {
  const input = resolve(filename);
  // No overwrites, including the input bundle, are allowed for report output.
  if (reportPath && resolve(reportPath) === input) throw new Error('Report output must not replace the input bundle.');
  const info = await stat(input);
  if (!info.isFile() || info.size > LIMIT) throw new Error('Input must be a regular paired JSON file of at most 4MiB.');
  const bytes = await readFile(input);
  if (bytes.length > LIMIT) throw new Error('Input exceeds 4MiB.');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const validator = await loadPairedValidator();
  const opened = await validator.readPairedReviewBundle(text);
  const a = opened.primary.log, b = opened.comparison.baseline;
  const receipt = {
    format: 'skydash-paired-validation-receipt-v1', bundle_format: opened.data.format,
    scope: 'Structural/source-byte/model/bounds validation only. No authenticated authorship, source truth, flight identity, grade, certification or readiness claim. Receipt is editable, not a signature. No automatic upload, storage or sharing.',
    primary: { sha256: a.sha256, samples: a.samples.length, start_s: 0, end_s: a.samples.at(-1).time_s },
    baseline: { sha256: b.sha256, samples: b.samples.length, start_s: 0, end_s: b.samples.at(-1).time_s },
    identical_source_bytes: a.sha256 === b.sha256,
    included_reviews: { primary_instructor_markers: opened.primary.data.debrief.markers.length, evaluated_envelope: Boolean(opened.primary.data.envelope), applied_manual_anchors: Boolean(opened.comparison.alignment) },
    notes: 'No private titles, filenames, notes, marker text, individual channel values or coordinates appear in this receipt. First-to-last spans are not continuous observation durations. Fingerprints may identify sensitive source bytes.'
  };
  if (reportPath) {
    const report = await validator.pairedReviewBundleReport(text);
    await writeFile(resolve(reportPath), report, { flag: 'wx', mode: 0o600 });
    receipt.readable_report_written = true;
    receipt.readable_report_warning = 'Explicit report output includes private reviewer text and may include marker coordinates. Text cannot reopen reviews. Existing files are never overwritten.';
  }
  return receipt;
}
async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log('Usage: npm run verify-paired-review -- BUNDLE.json [--report NEW_REPORT.txt]\nOffline validation with the same parser and nested validators as the app. JSON receipt to stdout, no private notes/coordinates. Optional report is sensitive, written only to a new file. No network/server/browser storage.'); return; }
  if (!(args.length === 1 || (args.length === 3 && args[1] === '--report')) || args[0].startsWith('-')) throw new Error('Usage: verify-paired-review BUNDLE.json [--report NEW_REPORT.txt]');
  console.log(JSON.stringify(await verifyPairedFile(args[0], { reportPath: args[2] || null }), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(() => { console.error('Paired bundle validation failed or report output could not be created. No receipt issued. Check the input JSON/UTF-8, 4MiB limit, exact nested hashes/models/review bounds and a new writable report path. Input bundle is unchanged.'); process.exitCode = 1; });
