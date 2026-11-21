#!/usr/bin/env node
// Verify original artifacts first. Never accept an imported success receipt as evidence.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
import { verifyTrainingLineage } from './verify-training-lineage.mjs';
import { renderTrainingIntake } from '../src/utils/trainingIntakeHtml.js';
export async function reportTrainingIntake(filename, { expectedSha256 = null, lineageManifest = null, confirmedWGS84 = false, expectedLineageSha256 = null, requireAllReviewSources = false } = {}) {
  if (lineageManifest === null && (confirmedWGS84 || expectedLineageSha256 !== null || requireAllReviewSources)) throw new Error('Lineage-only options require an explicit lineage manifest.');
  const lineage = lineageManifest === null ? null : await verifyTrainingLineage(filename, lineageManifest, { confirmedWGS84, expectedTrainingSha256: expectedSha256, expectedLineageSha256, requireAllReviewSources });
  const data = lineage ? lineage.training : await verifyTrainingManifest(filename, { expectedSha256 });
  return renderTrainingIntake(data, lineage);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help','-h'].includes(args[0])) console.log('Usage: node scripts/report-training-intake.mjs MANIFEST.json [--expect-sha256 HEX] [--lineage-manifest LINEAGE.json --confirm-wgs84 [--expect-lineage-sha256 HEX] [--require-all-review-sources]]\nValidate original manifest and every original bundle, then print one static offline HTML report to stdout. Optional explicit lineage requires fresh caller confirmation, reproduces all original/recipe/converted inputs and shows exact source-role links. Same limits/path rules and expected digests as existing validators. No imported success receipts, private text, partial reports, writes, external assets, scripts, network, upload, sharing, signatures or readiness claims. Explicit shell redirection is required to save the HTML.');
  else {
    const options = {}, seen = new Set(); let valid = args.length >= 1 && !args[0].startsWith('-');
    for (let index = 1; index < args.length && valid; index++) {
      const flag = args[index]; if (seen.has(flag)) { valid=false; break; } seen.add(flag);
      if (flag === '--confirm-wgs84') options.confirmedWGS84=true;
      else if (flag === '--require-all-review-sources') options.requireAllReviewSources=true;
      else if (flag === '--lineage-manifest' && args[index+1] && !args[index+1].startsWith('-')) options.lineageManifest=args[++index];
      else if (['--expect-sha256','--expect-lineage-sha256'].includes(flag) && /^[a-fA-F0-9]{64}$/.test(args[index+1] ?? '')) options[flag === '--expect-sha256' ? 'expectedSha256' : 'expectedLineageSha256']=args[++index];
      else valid=false;
    }
    if (!valid) { console.error('Expected an original intake manifest and supported nonrepeated options. Use --help.'); process.exitCode=1; }
    else reportTrainingIntake(args[0],options).then(html=>console.log(html)).catch(()=>{console.error('Original-artifact training intake failed. No HTML report issued or files written. Check original manifests, bundle/conversion paths, limits, expected digests, fresh coordinate confirmation and nested validation/source coverage. Private inputs are not echoed.');process.exitCode=1;});
  }
}
