#!/usr/bin/env node
// Explicit local file relations only. Neither manifest supplies coordinate confirmation.
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
import { verifyCSVConversion } from './verify-csv-conversion.mjs';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
export async function verifyTrainingLineage(trainingPath, lineagePath, { confirmedWGS84 = false, expectedTrainingSha256 = null, expectedLineageSha256 = null, requireAllReviewSources = false } = {}) {
  if (confirmedWGS84 !== true) throw new Error('Fresh confirmation for all listed original coordinates required.');
  if ([expectedTrainingSha256, expectedLineageSha256].some(value => value !== null && !digest(value))) throw new Error('Invalid expected manifest digest.');
  const path = await realpath(resolve(lineagePath)), root = dirname(path), info = await stat(path);
  if (!info.isFile() || info.size > 65536) throw new Error('Lineage manifest must be regular and up to64KiB.');
  const bytes = await readFile(path); if (bytes.length > 65536) throw new Error('Lineage manifest exceeds64KiB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedLineageSha256 !== null && sha256 !== expectedLineageSha256.toLowerCase()) throw new Error('Expected lineage manifest digest mismatch.');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  if (!exact(data, ['format', 'conversions']) || data.format !== 'skydash-training-lineage-manifest-v1' || !Array.isArray(data.conversions) || !data.conversions.length || data.conversions.length > 20) throw new Error('Invalid lineage format or conversion count.');
  const paths = new Set(), targets = []; let total = 0;
  for (const entry of data.conversions) {
    if (!exact(entry, ['original', 'recipe', 'converted'])) throw new Error('Invalid conversion entry.');
    const files = {};
    for (const role of ['original', 'recipe', 'converted']) {
      const item = entry[role];
      if (!exact(item, ['path', 'sha256']) || !digest(item.sha256) || typeof item.path !== 'string' || !item.path.length || item.path.length > 240 || item.path.includes('\\') || isAbsolute(item.path) || item.path.split('/').some(part => ['', '.', '..'].includes(part))) throw new Error('Invalid file reference.');
      const target = await realpath(resolve(root, item.path)), child = relative(root, target);
      if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child) || target === path || paths.has(target)) throw new Error('Files must be unique canonical in-folder files.');
      const file = await stat(target), limit = role === 'recipe' ? 65536 : 1048576;
      if (!file.isFile() || file.size > limit) throw new Error('File exceeds role limit or is not regular.');
      total += file.size; if (total > 20 * 1024 * 1024) throw new Error('Lineage inputs exceed20MiB.');
      paths.add(target); files[role] = { path: target, sha256: item.sha256.toLowerCase() };
    }
    targets.push(files);
  }
  const conversions = [];
  for (const [index, files] of targets.entries()) {
    const receipt = await verifyCSVConversion(files.original.path, files.recipe.path, files.converted.path, { confirmedWGS84: true });
    for (const role of ['original', 'recipe', 'converted']) if (receipt['exact_' + role + '_sha256'] !== files[role].sha256) throw new Error('Expected conversion input digest mismatch.');
    conversions.push({ ordinal: index + 1, receipt });
  }
  // Training validator independently checks its own expected full-artifact digests and paths.
  const training = await verifyTrainingManifest(trainingPath, { expectedSha256: expectedTrainingSha256 });
  const review_sources = [];
  for (const { ordinal, kind, receipt } of training.receipts) for (const role of kind === 'paired' ? ['primary', 'baseline'] : ['source']) {
    const source = receipt[role].sha256;
    review_sources.push({ bundle_ordinal: ordinal, kind, role, source_sha256: source, matching_conversion_ordinals: conversions.filter(item => item.receipt.exact_converted_sha256 === source).map(item => item.ordinal) });
  }
  const uncovered = review_sources.filter(item => !item.matching_conversion_ordinals.length);
  if (requireAllReviewSources && uncovered.length) throw new Error('Some review sources have no exact reproduced conversion link.');
  return { format: 'skydash-training-lineage-receipt-v1', exact_lineage_manifest_sha256: sha256, expected_lineage_manifest_digest_matched: expectedLineageSha256 !== null, require_all_review_sources: requireAllReviewSources, all_review_sources_linked: uncovered.length === 0, training, conversions, review_sources,
    unreferenced_conversion_ordinals: conversions.filter(item => !review_sources.some(source => source.matching_conversion_ordinals.includes(item.ordinal))).map(item => item.ordinal),
    scope: 'Every listed conversion reproduced with actual current adapter validators and all three expected raw-file digests checked; every training artifact independently validated before this one receipt. Links require exact converted CSV bytes in the listed review source role. Multiple conversion relations remain separate: one converted hash does not identify a unique original/recipe, aircraft, flight or person. Unlinked review sources may be native CSV or missing lineage; no conclusion is inferred. Fresh WGS84 confirmation is the caller statement for all listed originals, not manifest data or independent verification. Expected digests need an independent trusted route. No private paths, headers, notes, coordinates or individual readings printed, but hashes/bounds/counts/times can identify sensitive work. Both manifests and receipt are editable, not signatures, custody/authorship, verified OEM compatibility, authentic telemetry, independent flights, completion, grades or readiness. No combined flight/sample/duration totals, files written, network, upload, storage, sharing or aircraft commands. Each manifest owns its own folder and20MiB data budget; combined data bounded40MiB, plus two64KiB manifests. Inputs must remain unchanged during checking. This receipt is not a portable workspace or lineage backup; retain original files separately.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/verify-training-lineage.mjs TRAINING.json LINEAGE.json --confirm-wgs84 [--require-all-review-sources] [--expect-training-sha256 HEX] [--expect-lineage-sha256 HEX]\nOffline all-or-nothing exact conversion-to-review-source relation check. Lineage format skydash-training-lineage-manifest-v1 contains conversions (1to20), each exact original/recipe/converted objects with path and independently expected sha256. Paths unique canonical files inside lineage manifest folder; original/converted1MiB,recipe64KiB,total20MiB. Existing mixed training manifest limits apply separately. No automatic scan, writes, private data echo, source truth or readiness claim. Fresh confirmation covers every listed original. Default reports unlinked review roles; optional require-all fails if any lack a reproduced exact source link.');
  else {
    let options = {}, valid = args.length >= 3 && !args[0].startsWith('-') && !args[1].startsWith('-'); const seen = new Set();
    for (let index = 2; index < args.length && valid; index++) {
      const flag = args[index]; if (seen.has(flag)) { valid = false; break; } seen.add(flag);
      if (flag === '--confirm-wgs84') options.confirmedWGS84 = true;
      else if (flag === '--require-all-review-sources') options.requireAllReviewSources = true;
      else if (['--expect-training-sha256', '--expect-lineage-sha256'].includes(flag) && digest(args[index + 1])) options[flag === '--expect-training-sha256' ? 'expectedTrainingSha256' : 'expectedLineageSha256'] = args[++index];
      else valid = false;
    }
    if (!valid || !options.confirmedWGS84) { console.error('Expected two manifests, fresh --confirm-wgs84 and supported nonrepeated options. Use --help.'); process.exitCode = 1; }
    else verifyTrainingLineage(args[0], args[1], options).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Training lineage validation failed. No receipt or files written. Check manifest formats/pins, bounded unique in-folder files, all expected raw input digests, exact conversions and required source coverage. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
