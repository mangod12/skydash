#!/usr/bin/env node
// Caller-selected validated snapshots only, never a source of patches or verified chronology.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCaseValidator } from './verify-paired-review.mjs';
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
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
  const validator = await loadCaseValidator(), left = await checked(leftPath, expectedLeftSha256, validator), right = await checked(rightPath, expectedRightSha256, validator), sameSource = left.log.sha256 === right.log.sha256;
  const change = (a, b) => sameSource ? equal(a, b) ? 'unchanged' : 'changed' : 'not_compared_source_changed';
  return { format: 'skydash-review-case-revision-comparison-v1', left: { exact_bundle_sha256: left.sha256, source_sha256: left.log.sha256, expected_bundle_digest_matched: left.expectedMatched }, right: { exact_bundle_sha256: right.sha256, source_sha256: right.log.sha256, expected_bundle_digest_matched: right.expectedMatched }, exact_artifact_bytes_equal: left.sha256 === right.sha256, validated_content_equal: equal(left.data, right.data), source_bytes_equal: sameSource, source_filename_changed: left.log.filename !== right.log.filename,
    review: { comparable: sameSource, title: change(left.data.review.title, right.data.review.title), analyst_notes: change(left.data.review.notes, right.data.review.notes), instructor_markers: change(left.data.debrief.markers, right.data.debrief.markers), instructor_discussion: change(left.data.debrief.notes, right.data.debrief.notes), envelope_profile: change(left.data.envelope?.profile ?? null, right.data.envelope?.profile ?? null), envelope_notes: change(left.data.envelope?.notes ?? null, right.data.envelope?.notes ?? null) },
    scope: 'Both complete cases validated with actual source/model/marker-bound/envelope app validators before one receipt. LEFT/RIGHT are caller-selected roles, not verified earlier/later chronology. Optional independently obtained pins cover exact raw artifact bytes including text/formatting. Content equality ignores JSON formatting/object-key order after validator normalization, preserves text and normalized marker arrays. Exact source CSV equality gates every review flag. Changed sources suppress annotation comparison, even with identical labels/local IDs. Marker arrays compared whole, not matched as events or authenticated edits. Filename equality is metadata only, not source authenticity. No filenames, titles, notes, marker IDs/text, criteria values, coordinates or individual readings printed. Hashes/change patterns can identify sensitive work. Editable receipt, not a signature, authorship/custody, telemetry truth, flight/student identity, completion, grade or readiness. No merge, patch, annotation transfer, source repair, files written, reports generated, network, storage, upload, sharing or aircraft commands.' };
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
