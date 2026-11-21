#!/usr/bin/env node
// Compare independent validated snapshots, without accepting patch commands or imported results.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareCheckedNotebookReviews } from '../src/utils/notebookReviewComparison.js';
import { loadNotebookValidator } from './verify-paired-review.mjs';
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
async function checked(filename, validator, expected) {
  if (expected !== null && !digest(expected)) throw new Error('Invalid expected artifact digest.');
  const path = resolve(filename), info = await stat(path);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Each notebook must be a regular file up to2MiB.');
  const bytes = await readFile(path); if (bytes.length > 2 * 1024 * 1024) throw new Error('Notebook exceeds2MiB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expected !== null && sha256 !== expected.toLowerCase()) throw new Error('Expected complete-artifact digest mismatch.');
  return { opened: await validator.readNotebookSourceBundle(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)), sha256, expectedMatched: expected !== null };
}
export async function compareNotebookReviews(leftPath, rightPath, { expectedLeftSha256 = null, expectedRightSha256 = null } = {}) {
  const validator = await loadNotebookValidator(), left = await checked(leftPath, validator, expectedLeftSha256), right = await checked(rightPath, validator, expectedRightSha256);
  return compareCheckedNotebookReviews(left, right);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/compare-notebook-reviews.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nOptional independent full-artifact pins, not embedded CSV fingerprints. Read-only comparison of two independently validated exact-source notebook bundles,2MiB each. Matching CSV bytes gate copy comparison; editable local IDs associate copies with ordinal-only change flags. No private text, row bounds, writes, merge, inferred history or readiness claims. Left/right do not prove chronology.');
  else {
    let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-'); const options = {};
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !digest(args[index + 1])) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected left/right artifact paths and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else compareNotebookReviews(args[0], args[1], options).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Notebook revision comparison failed. No receipt or files written. Check both bounded regular UTF-8 bundle files and nested source/model/saved-copy bounds. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
