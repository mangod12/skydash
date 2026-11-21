#!/usr/bin/env node
// Compare two complete original packages before rendering. Never accept saved success receipts.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareTrainingPackages } from './compare-training-packages.mjs';
import { renderTrainingComparison } from '../src/utils/trainingComparisonHtml.js';
export async function reportTrainingComparison(leftPath, rightPath, options = {}) {
  const data = await compareTrainingPackages(leftPath, rightPath, options);
  return renderTrainingComparison(data);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/report-training-comparison.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nValidate both complete original training packages, then print one static offline HTML comparison with every artifact/source occurrence. Same limits and raw-file pins as compare-training-packages. No saved receipts, private text, scripts, external assets, inferred chronology/pairing, annotation transfer, writes, upload, sharing, authenticity or readiness claims. Explicit shell redirection required to save HTML.');
  else {
    const options = {}; let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-');
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !/^[a-fA-F0-9]{64}$/.test(args[index + 1] ?? '')) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected two original manifests and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else reportTrainingComparison(args[0], args[1], options).then(html => console.log(html)).catch(() => { console.error('Original-package comparison failed. No HTML issued or files written. Check both original manifests, independent expected digests, bounded canonical in-folder artifacts and nested source/model/review validation. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
