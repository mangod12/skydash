const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function compareCheckedNotebookReviews(left, right) {
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
