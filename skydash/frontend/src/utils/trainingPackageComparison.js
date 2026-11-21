// Compare freshly checked receipt projections, never imported success claims.
function inventory(packageReceipt) {
  const artifacts = [], sources = [];
  for (const { ordinal, kind, receipt } of packageReceipt.receipts) {
    artifacts.push({ ordinal, kind, sha256: receipt.exact_bundle_sha256 });
    for (const role of kind === 'paired' ? ['primary', 'baseline'] : ['source']) sources.push({ ordinal, kind, role, sha256: receipt[role].sha256 });
  }
  return { artifacts, sources };
}
function groups(left, right, type) {
  const map = new Map();
  for (const [side, items] of [['left', left], ['right', right]]) for (const item of items) {
    const key = type === 'artifact' ? item.kind + ':' + item.sha256 : item.sha256;
    if (!map.has(key)) map.set(key, { sha256: item.sha256, ...(type === 'artifact' ? { kind: item.kind } : {}), left_references: [], right_references: [] });
    map.get(key)[side + '_references'].push(type === 'artifact' ? { ordinal: item.ordinal } : { ordinal: item.ordinal, kind: item.kind, role: item.role });
  }
  return [...map.values()].map(group => ({ ...group, occurrence_counts_equal: group.left_references.length === group.right_references.length }));
}
export function compareCheckedTrainingPackages(left, right) {
  const a = inventory(left), b = inventory(right), artifactGroups = groups(a.artifacts, b.artifacts, 'artifact'), sourceGroups = groups(a.sources, b.sources, 'source');
  const sequenceEqual = a.artifacts.length === b.artifacts.length && a.artifacts.every((item, index) => item.kind === b.artifacts[index].kind && item.sha256 === b.artifacts[index].sha256);
  const summary = receipt => ({ exact_manifest_sha256: receipt.exact_manifest_sha256, expected_manifest_digest_matched: receipt.expected_manifest_digest_matched, manifest_receipt_format: receipt.format, bundle_count: receipt.bundle_count });
  return { format: 'skydash-training-package-comparison-v1', left: summary(left), right: summary(right), exact_manifest_bytes_equal: left.exact_manifest_sha256 === right.exact_manifest_sha256, ordered_artifact_sequence_equal: sequenceEqual, artifact_occurrence_inventory_equal: artifactGroups.every(group => group.occurrence_counts_equal), source_occurrence_inventory_equal: sourceGroups.every(group => group.occurrence_counts_equal), artifact_groups: artifactGroups, source_groups: sourceGroups,
    scope: 'Both original manifests and every complete artifact validated with current nested app validators and required raw artifact pins before one result. Each side retains its own in-folder paths, limits and20MiB budget, at most40MiB combined plus two64KiB manifests. Optional independent complete-manifest pins are separate from required artifact pins. Left/right are caller-selected snapshots, not verified earlier/later chronology. Ordered artifact sequence compares kind and exact complete JSON bytes, not manifest path labels, formatting or schema version. Artifact groups preserve kind and every ordinal occurrence. Source groups compare only exact embedded CSV bytes across every listed role; references preserve kind, role and ordinal, including identical A/B and repeated artifacts. Equal source occurrence inventory can hide different artifact reviews, ordering and role assignments: inspect all groups. No guessed pairing, annotation comparison, inferred additions/deletions, unique flights, students, independence or history. An unmatched group means only absent exact bytes on that side, not missing work. Hashes, occurrence counts and reuse patterns may identify sensitive work. No private filenames, paths, titles, notes, marker IDs/text, criteria, coordinates or readings printed. Editable unsigned result, not authenticated authorship/custody, source truth, compatibility, completion, grade or readiness. Keep inputs unchanged during checking. No merged package, patches, conversion-lineage checks, reports or files written, storage, network, upload, sharing or aircraft commands.' };
}
