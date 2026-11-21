#!/usr/bin/env node
// Read-only comparison of two independently validated artifacts. Inputs never supply code.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareCheckedPairedReviews } from '../src/utils/pairedReviewComparison.js';
import { loadPairedValidator } from './verify-paired-review.mjs';
const LIMIT = 4 * 1024 * 1024;
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
async function readChecked(filename, validator, expected) {
  if (expected !== null && !digest(expected)) throw new Error('Invalid expected artifact digest.');
  const path = resolve(filename), info = await stat(path);
  if (!info.isFile() || info.size > LIMIT) throw new Error('Each input must be a regular paired JSON file up to4MiB.');
  const bytes = await readFile(path); if (bytes.length > LIMIT) throw new Error('Input exceeds4MiB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expected !== null && sha256 !== expected.toLowerCase()) throw new Error('Expected complete-artifact digest mismatch.');
  const opened = await validator.readPairedReviewBundle(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  return { opened, sha256, expectedMatched: expected !== null };
}
export async function comparePairedReviews(leftPath, rightPath, { expectedLeftSha256 = null, expectedRightSha256 = null } = {}) {
  const validator = await loadPairedValidator();
  const left = await readChecked(leftPath, validator, expectedLeftSha256), right = await readChecked(rightPath, validator, expectedRightSha256);
  return compareCheckedPairedReviews(left, right);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/compare-paired-reviews.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nOptional independent full-artifact pins, not embedded CSV fingerprints. Read-only offline comparison of two validated paired artifacts, up to4MiB each. Outputs digests and section change flags, never private text/coordinates. Exact source-role matching gates review comparisons. Left/right do not prove revision chronology. No writes, row matching, annotation transfer, signatures or readiness claims.');
  else {
    let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-'); const options = {};
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !digest(args[index + 1])) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected left/right artifact paths and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else comparePairedReviews(args[0], args[1], options).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Paired revision comparison failed. No comparison receipt issued or files written. Check both regular UTF-8 JSON files,4MiB limits and nested source hashes/models/review bounds. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
