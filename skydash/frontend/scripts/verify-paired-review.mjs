#!/usr/bin/env node
// Offline reader only. Validation code comes from this checkout, never from the input file.
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 4 * 1024 * 1024;
async function loadValidator(entry) {
  const output = await build({ configFile: false, root, logLevel: 'silent', build: { ssr: resolve(root, entry), write: false, minify: false, sourcemap: false } });
  const chunks = output.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('Expected a single offline validation module.');
  return import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64'));
}
export const loadPairedValidator = () => loadValidator('src/utils/pairedReviewBundle.js');
export const loadCaseValidator = () => loadValidator('src/utils/reviewCase.js');
export const loadNotebookValidator = () => loadValidator('src/utils/notebookSourceBundle.js');
export async function verifyPairedFile(filename, { reportPath = null, expectedSha256 = null } = {}) {
  if (expectedSha256 !== null && !/^[a-fA-F0-9]{64}$/.test(expectedSha256)) throw new Error('Expected bundle SHA-256 must contain exactly64hexadecimal characters.');
  const input = resolve(filename);
  // No overwrites, including the input bundle, are allowed for report output.
  if (reportPath && resolve(reportPath) === input) throw new Error('Report output must not replace the input bundle.');
  const info = await stat(input);
  if (!info.isFile() || info.size > LIMIT) throw new Error('Input must be a regular paired JSON file of at most 4MiB.');
  const bytes = await readFile(input);
  if (bytes.length > LIMIT) throw new Error('Input exceeds 4MiB.');
  const bundleSha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha256 !== null && bundleSha256 !== expectedSha256.toLowerCase()) throw new Error('Exact bundle SHA-256 does not match the separately supplied expected digest.');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const validator = await loadPairedValidator();
  const opened = await validator.readPairedReviewBundle(text);
  const a = opened.primary.log, b = opened.comparison.baseline;
  const receipt = {
    format: 'skydash-paired-validation-receipt-v1', exact_bundle_sha256: bundleSha256, expected_bundle_digest_matched: expectedSha256 !== null, bundle_format: opened.data.format,
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
  const usage = 'Usage: npm run verify-paired-review -- BUNDLE.json [--expect-sha256 HEX] [--report NEW_REPORT.txt]';
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(usage + '\nOffline validation with the same parser and nested validators as the app. JSON receipt to stdout, no private notes/coordinates. Optional report is sensitive, written only to a new file. Expected digest compares exact entire bundle bytes, including reviewer text and whitespace; source-only fingerprints do not cover those. Obtain the digest separately. Digest agreement is not authenticity or a signature. No network/server/browser storage.'); return; }
  if (!args.length || args[0].startsWith('-') || args.length % 2 !== 1) throw new Error(usage);
  const options = {};
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index] === '--report' ? 'reportPath' : args[index] === '--expect-sha256' ? 'expectedSha256' : null;
    if (!key || key in options || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(usage);
    options[key] = args[index + 1];
  }
  console.log(JSON.stringify(await verifyPairedFile(args[0], options), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(() => { console.error('Paired bundle validation failed or report output could not be created. No receipt issued. Check the input JSON/UTF-8, 4MiB limit, exact nested hashes/models/review bounds, expected entire-bundle digest if supplied, and a new writable report path. Input bundle is unchanged.'); process.exitCode = 1; });
