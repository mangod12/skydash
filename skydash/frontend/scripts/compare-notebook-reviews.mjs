#!/usr/bin/env node
// Compare independent validated snapshots, without accepting patch commands or imported results.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadNotebookValidator } from './verify-paired-review.mjs';
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
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
  const a = left.opened, b = right.opened, sameSource = a.log.sha256 === b.log.sha256;
  let review = { comparable: false, reason: 'not_compared_source_changed' };
  if (sameSource) {
    const before = a.data.notebook.windows, after = b.data.notebook.windows;
    const first = new Map(before.map((copy, index) => [copy.id, { copy, ordinal: index + 1 }])), second = new Map(after.map((copy, index) => [copy.id, { copy, ordinal: index + 1 }]));
    const matched = before.filter(copy => second.has(copy.id)).map(copy => {
      const leftCopy = first.get(copy.id), rightCopy = second.get(copy.id), next = rightCopy.copy;
      return { left_ordinal: leftCopy.ordinal, right_ordinal: rightCopy.ordinal, ordinal_changed: leftCopy.ordinal !== rightCopy.ordinal, inclusive_bounds_changed: copy.first_row !== next.first_row || copy.last_row !== next.last_row, label_changed: copy.label !== next.label, notes_changed: copy.notes !== next.notes };
    });
    review = { comparable: true, matched_by_local_id: matched, left_only_ordinals: before.flatMap((copy, index) => second.has(copy.id) ? [] : [index + 1]), right_only_ordinals: after.flatMap((copy, index) => first.has(copy.id) ? [] : [index + 1]) };
  }
  return { format: 'skydash-notebook-revision-comparison-v1', left: { exact_bundle_sha256: left.sha256, expected_bundle_digest_matched: left.expectedMatched, source_sha256: a.log.sha256, saved_copy_count: a.data.notebook.windows.length }, right: { exact_bundle_sha256: right.sha256, expected_bundle_digest_matched: right.expectedMatched, source_sha256: b.log.sha256, saved_copy_count: b.data.notebook.windows.length }, exact_artifact_bytes_equal: left.sha256 === right.sha256, validated_content_equal: equal(a.data, b.data), source_bytes_equal: sameSource, source_filename_changed: a.log.filename !== b.log.filename, review,
    scope: 'LEFT/RIGHT are caller-selected snapshots, not verified earlier/later chronology. Both complete artifacts validated before any receipt. Optional independently obtained expected digests checked against each complete raw artifact before parsing, including private text and JSON formatting. Content equality ignores JSON formatting/object-key order, preserves saved-copy array order and text. Notebook review compared only when exact embedded CSV bytes match. Matching uses editable snapshot-local IDs, not authenticated copy identity, authorship or proven edit history. Ordinals refer only to each listed snapshot. Same-ID copies can have changed bounds/text; different IDs remain left/right-only even with identical content. No similarity matching, inferred duplicate identity, annotation transfer, merge or patch. No filenames, IDs, labels, notes, coordinates, row bounds or individual readings printed. Hashes/counts/change patterns can identify sensitive work. No flight/student identity, custody, signature, completion, grade or readiness claims. No files written, reports generated, network, storage, upload, sharing or aircraft commands.' };
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
