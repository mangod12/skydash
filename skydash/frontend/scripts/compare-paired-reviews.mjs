#!/usr/bin/env node
// Read-only comparison of two independently validated artifacts. Inputs never supply code.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPairedValidator } from './verify-paired-review.mjs';
const LIMIT = 4 * 1024 * 1024;
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const change = (a, b, comparable) => comparable ? equal(a, b) ? 'unchanged' : 'changed' : 'not_compared_source_changed';
async function readChecked(filename, validator, expected) {
  if (expected !== null && !digest(expected)) throw new Error('Invalid expected artifact digest.');
  const path = resolve(filename), info = await stat(path);
  if (!info.isFile() || info.size > LIMIT) throw new Error('Each input must be a regular paired JSON file up to4MiB.');
  const bytes = await readFile(path); if (bytes.length > LIMIT) throw new Error('Input exceeds4MiB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expected !== null && sha256 !== expected.toLowerCase()) throw new Error('Expected complete-artifact digest mismatch.');
  const opened = await validator.readPairedReviewBundle(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  return { opened, sha256, expectedMatched: expected !== null };
}
export async function comparePairedReviews(leftPath, rightPath, { expectedLeftSha256 = null, expectedRightSha256 = null } = {}) {
  const validator = await loadPairedValidator();
  const left = await readChecked(leftPath, validator, expectedLeftSha256), right = await readChecked(rightPath, validator, expectedRightSha256);
  const a = left.opened, b = right.opened, sameA = a.primary.log.sha256 === b.primary.log.sha256, sameB = a.comparison.baseline.sha256 === b.comparison.baseline.sha256, samePair = sameA && sameB;
  return {
    format: 'skydash-paired-revision-comparison-v1',
    left: { exact_bundle_sha256: left.sha256, expected_bundle_digest_matched: left.expectedMatched, primary_sha256: a.primary.log.sha256, baseline_sha256: a.comparison.baseline.sha256 },
    right: { exact_bundle_sha256: right.sha256, expected_bundle_digest_matched: right.expectedMatched, primary_sha256: b.primary.log.sha256, baseline_sha256: b.comparison.baseline.sha256 },
    exact_artifact_bytes_equal: left.sha256 === right.sha256,
    validated_content_equal: equal(a.data, b.data),
    source_roles: { primary_bytes_equal: sameA, baseline_bytes_equal: sameB, ordered_pair_bytes_equal: samePair },
    metadata: { primary_filename: change(a.primary.log.filename, b.primary.log.filename, true), baseline_filename: change(a.comparison.baseline.filename, b.comparison.baseline.filename, true), baseline_title: change(a.comparison.baseline.title, b.comparison.baseline.title, true) },
    primary_review: {
      comparable: sameA,
      title: change(a.primary.data.review.title, b.primary.data.review.title, sameA),
      analyst_notes: change(a.primary.data.review.notes, b.primary.data.review.notes, sameA),
      instructor_markers: change(a.primary.data.debrief.markers, b.primary.data.debrief.markers, sameA),
      instructor_discussion: change(a.primary.data.debrief.notes, b.primary.data.debrief.notes, sameA),
      envelope_profile: change(a.primary.data.envelope?.profile ?? null, b.primary.data.envelope?.profile ?? null, sameA),
      envelope_notes: change(a.primary.data.envelope?.notes ?? null, b.primary.data.envelope?.notes ?? null, sameA),
    },
    comparison_review: { comparable: samePair, notes: change(a.comparison.notes, b.comparison.notes, samePair), applied_anchors: change(a.comparison.alignment, b.comparison.alignment, samePair) },
    scope: 'LEFT and RIGHT are caller-selected roles, not verified earlier/later revisions. Both artifacts independently validated before any receipt. Optional independently obtained expected digests checked against each complete raw artifact before parsing, including private text and JSON formatting. Exact byte equality includes formatting; validated content equality ignores object-key order/JSON formatting after shared validator normalization (including marker sorting by time/ID); text is preserved. Primary reviews compared only for exact matching primary CSV bytes; comparison reviews only for the same ordered A/B source bytes. Changed source roles suppress review comparison, no row/marker matching or annotation transfer. Metadata comparison is text equality only. No filenames, titles, notes, marker IDs/text, anchor labels, coordinates or individual channel values printed. Hashes and change patterns can still identify sensitive work. Editable receipt, not authenticated authorship, source truth, a signature, chain of custody, flight/student identity, training completion, grade or readiness. No files written, network, storage, upload, sharing or aircraft commands.'
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/compare-paired-reviews.mjs LEFT.json RIGHT.json [--expect-left-sha256 HEX] [--expect-right-sha256 HEX]\nOptional independent full-artifact pins, not embedded CSV fingerprints. Read-only offline comparison of two validated paired artifacts, up to4MiB each. Outputs digests and section change flags, never private text/coordinates. Exact source-role matching gates review comparisons. Left/right do not prove revision chronology. No writes, row matching, annotation transfer, signatures or readiness claims.');
  else {
    let valid = args.length >= 2 && !args[0].startsWith('-') && !args[1].startsWith('-'); const options = {};
    for (let index = 2; index < args.length && valid; index += 2) {
      const key = args[index] === '--expect-left-sha256' ? 'expectedLeftSha256' : args[index] === '--expect-right-sha256' ? 'expectedRightSha256' : null;
      if (!key || key in options || !digest(args[index + 1])) valid = false; else options[key] = args[index + 1];
    }
    if (!valid) { console.error('Expected left/right artifact paths and supported nonrepeated expected-digest options. Use --help.'); process.exitCode = 1; }
    else comparePairedReviews(args[0], args[1], options).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Paired revision comparison failed. No comparison receipt issued or files written. Check both regular UTF-8 JSON files,4MiB limits and nested source hashes/models/review bounds. Private inputs are not echoed.'); process.exitCode = 1; });
  }
}
