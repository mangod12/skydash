#!/usr/bin/env node
// Compare only validated caller-selected packages, never inferred revisions or identities.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
const digest = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
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
export async function compareTrainingPackages(leftPath, rightPath, { expectedLeftSha256 = null, expectedRightSha256 = null } = {}) {
  if ((expectedLeftSha256 !== null && !digest(expectedLeftSha256)) || (expectedRightSha256 !== null && !digest(expectedRightSha256))) throw new Error('Invalid expected manifest digest.');
  const left = await verifyTrainingManifest(leftPath, { expectedSha256: expectedLeftSha256 });
  const right = await verifyTrainingManifest(rightPath, { expectedSha256: expectedRightSha256 });
  const a = inventory(left), b = inventory(right), artifactGroups = groups(a.artifacts, b.artifacts, 'artifact'), sourceGroups = groups(a.sources, b.sources, 'source');
  const sequenceEqual = a.artifacts.length === b.artifacts.length && a.artifacts.every((item, index) => item.kind === b.artifacts[index].kind && item.sha256 === b.artifacts[index].sha256);
  const summary = receipt => ({ exact_manifest_sha256: receipt.exact_manifest_sha256, expected_manifest_digest_matched: receipt.expected_manifest_digest_matched, manifest_receipt_format: receipt.format, bundle_count: receipt.bundle_count });
  return { format: 'skydash-training-package-comparison-v1', left: summary(left), right: summary(right), exact_manifest_bytes_equal: left.exact_manifest_sha256 === right.exact_manifest_sha256, ordered_artifact_sequence_equal: sequenceEqual, artifact_occurrence_inventory_equal: artifactGroups.every(group => group.occurrence_counts_equal), source_occurrence_inventory_equal: sourceGroups.every(group => group.occurrence_counts_equal), artifact_groups: artifactGroups, source_groups: sourceGroups,
    scope: 'Both original manifests and every complete artifact validated with current nested app validators and required raw artifact pins before one result. Each side retains its own in-folder paths, limits and20MiB budget, at most40MiB combined plus two64KiB manifests. Optional independent complete-manifest pins are separate from required artifact pins. Left/right are caller-selected snapshots, not verified earlier/later chronology. Ordered artifact sequence compares kind and exact complete JSON bytes, not manifest path labels, formatting or schema version. Artifact groups preserve kind and every ordinal occurrence. Source groups compare only exact embedded CSV bytes across every listed role; references preserve kind, role and ordinal, including identical A/B and repeated artifacts. Equal source occurrence inventory can hide different artifact reviews, ordering and role assignments: inspect all groups. No guessed pairing, annotation comparison, inferred additions/deletions, unique flights, students, independence or history. An unmatched group means only absent exact bytes on that side, not missing work. Hashes, occurrence counts and reuse patterns may identify sensitive work. No private filenames, paths, titles, notes, marker IDs/text, criteria, coordinates or readings printed. Editable unsigned result, not authenticated authorship/custody, source truth, compatibility, completion, grade or readiness. Keep inputs unchanged during checking. No merged package, patches, conversion-lineage checks, reports or files written, storage, network, upload, sharing or aircraft commands.' };
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
