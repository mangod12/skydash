#!/usr/bin/env node
// Explicit local archive only. Never upload, extract or accept prior success receipts.
import { createHash } from 'node:crypto';
import { readFile, realpath, stat, open } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, basename, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
import { verifyTrainingLineage } from './verify-training-lineage.mjs';
import { reportTrainingIntake } from './report-training-intake.mjs';
import { reportPrivateTraining } from './report-private-training.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
import { storedZipBytes } from '../src/utils/storedZip.js';
export const storedZip = entries => Buffer.from(storedZipBytes(entries));
async function manifestFile(path, expected) {
  const canonical = await realpath(resolve(path)), info = await stat(canonical); if (!info.isFile() || info.size > 65536) throw Error('Invalid manifest size.');
  const bytes = await readFile(canonical); if (bytes.length > 65536 || sha(bytes) !== expected) throw Error('Manifest changed during archive preparation.');
  return { canonical, bytes, root: dirname(canonical), data: JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)) };
}
async function original(root, path, expected, limit) {
  const canonical = await realpath(resolve(root, path)), child = relative(root, canonical); if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) throw Error('Archive input outside manifest folder.');
  const info = await stat(canonical); if (!info.isFile() || info.size > limit) throw Error('Archive input exceeds limit.'); const bytes = await readFile(canonical); if (bytes.length > limit || sha(bytes) !== expected.toLowerCase()) throw Error('Original bytes changed during archive preparation.'); return bytes;
}
export async function prepareTrainingArchive(trainingPath, { lineageManifest = null, confirmedWGS84 = false, expectedSha256 = null, expectedLineageSha256 = null, requireAllReviewSources = false, includePrivateReview = false } = {}) {
  if (typeof includePrivateReview !== 'boolean') throw Error('Explicit private-output flag required.');
  if (lineageManifest === null && (confirmedWGS84 || expectedLineageSha256 !== null || requireAllReviewSources)) throw Error('Lineage options need explicit manifest.');
  const lineage = lineageManifest === null ? null : await verifyTrainingLineage(trainingPath, lineageManifest, { confirmedWGS84, expectedTrainingSha256: expectedSha256, expectedLineageSha256, requireAllReviewSources });
  const checked = lineage ? lineage.training : await verifyTrainingManifest(trainingPath, { expectedSha256 });
  const html = await reportTrainingIntake(trainingPath, { lineageManifest, confirmedWGS84, expectedSha256, expectedLineageSha256, requireAllReviewSources });
  if (!html.includes(checked.exact_manifest_sha256) || (lineage && !html.includes(lineage.exact_lineage_manifest_sha256))) throw Error('Inputs changed while reporting.');
  const privateHtml = includePrivateReview ? await reportPrivateTraining(trainingPath, { includePrivateReview: true, expectedSha256 }) : null;
  if (privateHtml !== null && !privateHtml.includes(checked.exact_manifest_sha256)) throw Error('Original manifest changed while preparing private packet.');
  const training = await manifestFile(trainingPath, checked.exact_manifest_sha256), manifestName = 'training/' + basename(training.canonical), entries = [[manifestName, training.bytes]];
  for (const item of training.data.bundles) entries.push(['training/' + item.path, await original(training.root, item.path, item.sha256, (item.kind === 'paired' ? 4 : 2) * 1024 * 1024)]);
  let lineageName = null;
  if (lineage) {
    const source = await manifestFile(lineageManifest, lineage.exact_lineage_manifest_sha256); lineageName = 'lineage/' + basename(source.canonical); entries.push([lineageName, source.bytes]);
    for (const relation of source.data.conversions) for (const role of ['original', 'recipe', 'converted']) { const item = relation[role]; entries.push(['lineage/' + item.path, await original(source.root, item.path, item.sha256, role === 'recipe' ? 65536 : 1024 * 1024)]); }
  }
  entries.push(['reports/intake-report.html', Buffer.from(html)], ['reports/validation.json', Buffer.from(JSON.stringify(lineage || checked, null, 2))]);
  if (privateHtml !== null) entries.push(['reports/private-discussion.html', Buffer.from(privateHtml)]);
  const guide = ['SKYDASH / SENSITIVE LOCAL HANDOFF ARCHIVE', '', 'Contains original source coordinates, private notes and mapping originals when explicitly supplied. Not encrypted. No upload or sharing performed. Confirm audience and use an appropriate secure channel separately.', '', 'Extract into a new private folder with your own trusted archive tool. The manifests and all listed originals keep their folder layout. From a SkyDash checkout with dependencies installed, run from skydash/frontend:', 'node scripts/verify-training-manifest.mjs TRAINING.json', ...(lineageName ? ['node scripts/verify-training-lineage.mjs TRAINING.json LINEAGE.json --confirm-wgs84', 'Fresh WGS84 confirmation is your statement, not imported authority. Review originals before supplying it.'] : ['No conversion lineage was supplied or checked.']), 'Replace TRAINING.json and LINEAGE.json placeholders with the extracted manifest paths using your shell-safe quoting. Manifest archive paths are listed below as data, not shell commands:', JSON.stringify({ training_manifest: manifestName, lineage_manifest: lineageName }), '', 'Generated hashes/receipts/HTML are editable, not independent authentication, signatures, custody, verified flight/student identity, grades, completion or readiness. Obtain expected hashes separately through a trusted route. No archive extraction, original edits or aircraft commands were performed by packaging.', 'The archive contains only explicitly listed files plus these reports. It is not a complete workspace backup or handoff certificate. Preserve other excluded work separately. Keep inputs unchanged throughout checking. Archive timestamps are fixed, not observation or creation times.'].join('\n');
  const privateGuide = privateHtml === null ? '' : '\n\nSENSITIVE PRIVATE DISCUSSION PACKET INCLUDED by explicit --include-private-review acknowledgement. reports/private-discussion.html contains readable private notes, metadata, selected coordinates/readings, marker/criteria and comparison context, depending on original kinds. This is separate from the privacy-reduced intake report. Section exclusions remain local to each chapter. It is static escaped unsigned output, not a reopenable backup, authenticated record, grades, completion or readiness. The private packet does not check conversion lineage; only the separate intake report/validation describe explicitly supplied lineage. Never add repeated sources/copies into independent flights or completion totals. Confirm audiences and approved secure transport yourself. Recompute from preserved original manifests/files using a separate trusted checkout; do not trust co-delivered reports/receipts or execute received code. No automatic sharing.\n';
  entries.push(['reports/READ-ME.txt', Buffer.from(guide + privateGuide)]);
  return { bytes: storedZip(entries), fileCount: entries.length, bundleCount: checked.bundle_count, lineageIncluded: Boolean(lineage), ...(privateHtml === null ? {} : { privateDiscussionIncluded: true }) };
}
export async function writeTrainingArchive(trainingPath, outputPath, options) {
  const prepared = await prepareTrainingArchive(trainingPath, options); const file = await open(resolve(outputPath), 'wx', 0o600);
  try { await file.writeFile(prepared.bytes); } finally { await file.close(); }
  return { format: 'skydash-training-archive-receipt-v1', exact_archive_sha256: sha(prepared.bytes), archive_bytes: prepared.bytes.length, archive_file_count: prepared.fileCount, bundle_count: prepared.bundleCount, conversion_lineage_included: prepared.lineageIncluded, ...(prepared.privateDiscussionIncluded ? { private_discussion_included: true } : {}), scope: 'Sensitive unencrypted ZIP written only to the explicitly chosen new path. Existing files never overwritten. Contains whole originals including private coordinates/reviews and optional mapping originals, not only report summaries. Output names are sensitive; no paths echoed here. Byte agreement and editable reports are not authenticated authorship/custody, source truth, flight identity, completion, grade or readiness. Not a complete workspace backup. No extraction, upload, network, sharing, storage elsewhere or aircraft commands. If a write fails, the newly created output may be incomplete; no success receipt is issued. Verify archive bytes and preserve originals separately.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/package-training-intake.mjs MANIFEST.json --output NEW.zip [--include-private-review] [--expect-sha256 HEX] [--lineage-manifest LINEAGE.json --confirm-wgs84 [--expect-lineage-sha256 HEX] [--require-all-review-sources]]\nExplicit new sensitive unencrypted ZIP of every validated original, original manifests and freshly generated report/receipt/guide. Optional --include-private-review explicitly acknowledges adding a readable sensitive discussion packet for every listed original (strict private-print path/model/16MiB-output limits). Default archive excludes that packet; originals always contain sensitive data. Private packet has no lineage check; the separate intake report retains its explicit lineage scope. No prior success receipts or scans. Existing files never overwritten, files mode0600. Same per-manifest path/limits as validators, combined data40MiB plus manifests/reports. Rechecks copied exact bytes against validated expectations. No upload, extraction, sharing, independent authentication or complete-backup claim.');
  else {
    const options = {}, seen = new Set(); let output = null, valid = args.length > 0 && !args[0].startsWith('-');
    for (let index = 1; index < args.length && valid; index++) { const flag = args[index]; if (seen.has(flag)) { valid = false; break; } seen.add(flag); if (flag === '--include-private-review') options.includePrivateReview = true; else if (flag === '--confirm-wgs84') options.confirmedWGS84 = true; else if (flag === '--require-all-review-sources') options.requireAllReviewSources = true; else if (['--output', '--lineage-manifest'].includes(flag) && args[index + 1] && !args[index + 1].startsWith('-')) { if (flag === '--output') output = args[++index]; else options.lineageManifest = args[++index]; } else if (['--expect-sha256', '--expect-lineage-sha256'].includes(flag) && pin(args[index + 1])) options[flag === '--expect-sha256' ? 'expectedSha256' : 'expectedLineageSha256'] = args[++index]; else valid = false; }
    if (!valid || !output) { console.error('Expected original manifest, explicit new output path and supported nonrepeated options. Use --help.'); process.exitCode = 1; }
    else writeTrainingArchive(args[0], output, options).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Training archive not completed. No success receipt. Check original files, digests, path/size/model bounds, lineage confirmation and a new writable output path. Existing files not overwritten; a new output may be incomplete if writing failed. Private inputs not echoed.'); process.exitCode = 1; });
  }
}
