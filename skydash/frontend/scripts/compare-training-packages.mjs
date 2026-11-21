#!/usr/bin/env node
// Compare only validated caller-selected packages, never inferred revisions or identities.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
import { compareCheckedTrainingPackages } from '../src/utils/trainingPackageComparison.js';
export async function compareTrainingPackages(leftPath, rightPath, { expectedLeftSha256 = null, expectedRightSha256 = null } = {}) {
  if ((expectedLeftSha256 !== null && !digest(expectedLeftSha256)) || (expectedRightSha256 !== null && !digest(expectedRightSha256))) throw new Error('Invalid expected manifest digest.');
  const left = await verifyTrainingManifest(leftPath, { expectedSha256: expectedLeftSha256 });
  const right = await verifyTrainingManifest(rightPath, { expectedSha256: expectedRightSha256 });
  return compareCheckedTrainingPackages(left, right);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/compare-training-packages.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nRead-only comparison of two original training manifests and all case/notebook/paired artifacts. Validates each full package first; compares exact manifest, ordered artifacts and occurrence inventories, retaining all ordinal/source-role references. Optional independent complete-manifest pins per side. No inferred revision pairing, annotation transfer, flight totals, private text, lineage or authenticity claim. No files written.');
  else {
    let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-'); const options = {};
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !digest(args[index + 1])) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected left/right manifest paths and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else compareTrainingPackages(args[0], args[1], options).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Training package comparison failed. No result or files written. Check both original manifests, independent expected digests, bounded canonical in-folder artifacts and nested model/source/review validation. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
