#!/usr/bin/env node
// Explicit selected original cases only. Review flags stay gated by exact source CSV agreement.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderReviewCaseComparison } from '../src/utils/reviewCaseComparisonHtml.js';
import { compareReviewCases } from './compare-review-cases.mjs';
export async function reportReviewCaseComparison(leftPath, rightPath, options = {}) {
  return renderReviewCaseComparison(await compareReviewCases(leftPath, rightPath, options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/report-review-case-comparison.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nValidate two explicit original cases, then print one static offline HTML report. Exact source CSV agreement gates every section flag. Same raw-file expectations, nested validation and 2MiB/case limits as compare-review-cases. No saved receipts, private text, scripts, external assets, inferred chronology/pairing, annotation transfer, writes, upload, sharing, authenticity or readiness claims. Explicit shell redirection required to save HTML.');
  else {
    const options = {}; let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-');
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !/^[a-fA-F0-9]{64}$/.test(args[index + 1] ?? '')) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected two original cases and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else reportReviewCaseComparison(args[0], args[1], options).then(html => console.log(html)).catch(() => { console.error('Original-case comparison failed. No HTML issued or files written. Check both original cases, independent expected digests, regular UTF-8 file limits and nested source/model/review validation. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
