#!/usr/bin/env node
// Caller-selected validated snapshots only, never a source of patches or verified chronology.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareCheckedReviewCases } from '../src/utils/reviewCaseComparison.js';
import { loadCaseValidator } from './verify-paired-review.mjs';
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
async function checked(filename, expected, validator) {
  if (expected !== null && !digest(expected)) throw new Error('Invalid expected case digest.');
  const path = resolve(filename), info = await stat(path);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Each case must be a regular file up to2MiB.');
  const bytes = await readFile(path); if (bytes.length > 2 * 1024 * 1024) throw new Error('Case exceeds2MiB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expected !== null && sha256 !== expected.toLowerCase()) throw new Error('Expected full case digest mismatch.');
  return { ...await validator.readReviewCase(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)), sha256, expectedMatched: expected !== null };
}
export async function compareReviewCases(leftPath, rightPath, { expectedLeftSha256 = null, expectedRightSha256 = null } = {}) {
  const validator = await loadCaseValidator(), left = await checked(leftPath, expectedLeftSha256, validator), right = await checked(rightPath, expectedRightSha256, validator);
  return compareCheckedReviewCases(left, right);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/compare-review-cases.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nOffline read-only source-gated review-case snapshot comparison,2MiB each. Independently expected full-artifact pins optional per side. Full nested validation before any receipt; flags only, no private text/coordinates, patches or verified history. Left/right do not prove chronology or readiness.');
  else {
    let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-'); const options = {};
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !digest(args[index + 1])) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected left/right case paths and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else compareReviewCases(args[0], args[1], options).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Review case comparison failed. No receipt or files written. Check both bounded regular UTF-8 cases, independent expected digests and nested source/model/review bounds. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
