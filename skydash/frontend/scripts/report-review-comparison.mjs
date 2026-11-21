#!/usr/bin/env node
// Fixed notebook/paired readers only. Input snapshots never choose code or report instructions.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderReviewComparison } from '../src/utils/reviewComparisonHtml.js';
import { compareNotebookReviews } from './compare-notebook-reviews.mjs';
import { comparePairedReviews } from './compare-paired-reviews.mjs';
export async function reportReviewComparison(kind, leftPath, rightPath, options = {}) {
  if (!['notebook', 'paired'].includes(kind)) throw Error('Select explicit notebook or paired kind.');
  return renderReviewComparison(kind, await (kind === 'notebook' ? compareNotebookReviews : comparePairedReviews)(leftPath, rightPath, options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/report-review-comparison.mjs notebook|paired LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nValidates two explicit original notebooks or paired bundles before static offline HTML. Exact source gates, optional independent full-artifact pins and nested limits match current comparators. No imported receipts, private text, row bounds, scripts, external assets, writes, upload, sharing, patches, inferred history or readiness claims.');
  else {
    const options = {}; let valid = args.length >= 3 && ['notebook', 'paired'].includes(args[0]) && !args[1].startsWith('-') && !args[2].startsWith('-');
    for (let i = 3; i < args.length && valid; i += 2) { const key = args[i] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[i] === '--expect-right-sha256' ? 'expectedRightSha256' : null; if (!key || key in options || !/^[a-fA-F0-9]{64}$/.test(args[i + 1] ?? '')) valid = false; else options[key] = args[i + 1]; }
    if (!valid) { console.error('Expected explicit notebook or paired kind, two originals and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else reportReviewComparison(args[0], args[1], args[2], options).then(html => console.log(html)).catch(() => { console.error('Original-review comparison failed. No HTML issued or files written. Check explicit kind, both bounded regular UTF-8 originals, independently expected whole-artifact digests and nested source/model/review bounds. Private inputs not echoed.'); process.exitCode = 1; });
  }
}
