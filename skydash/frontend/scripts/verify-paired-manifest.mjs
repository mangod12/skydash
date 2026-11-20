#!/usr/bin/env node
// Manifest entries are data paths within the explicitly selected intake folder, never code.
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPairedFile } from './verify-paired-review.mjs';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const MAX_BYTES = 20 * 1024 * 1024;
export async function verifyPairedManifest(filename) {
  const manifestPath = await realpath(resolve(filename)), root = dirname(manifestPath), info = await stat(manifestPath);
  if (!info.isFile() || info.size > 64 * 1024) throw new Error('Manifest must be a regular file up to64KiB.');
  const raw = await readFile(manifestPath); if (raw.length > 64 * 1024) throw new Error('Manifest exceeds64KiB.');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw));
  if (!exact(data, ['format', 'bundles']) || data.format !== 'skydash-paired-intake-manifest-v1' || !Array.isArray(data.bundles) || !data.bundles.length || data.bundles.length > 20) throw new Error('Unsupported manifest format or batch size.');
  const targets = [], paths = new Set(); let bytes = 0;
  for (const item of data.bundles) {
    if (!exact(item, ['path', 'sha256']) || typeof item.path !== 'string' || !item.path.length || item.path.length > 240 || item.path.includes('\\') || isAbsolute(item.path) || item.path.split('/').some(part => ['', '.', '..'].includes(part)) || typeof item.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(item.sha256)) throw new Error('Invalid manifest entry.');
    const target = await realpath(resolve(root, item.path)), child = relative(root, target);
    if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child) || paths.has(target) || target === manifestPath) throw new Error('Entries must be unique files within the selected manifest folder.');
    const file = await stat(target); if (!file.isFile() || file.size > 4 * 1024 * 1024) throw new Error('Bundle entry is not a regular file or exceeds4MiB.');
    bytes += file.size; if (bytes > MAX_BYTES) throw new Error('Batch exceeds20MiB.');
    paths.add(target); targets.push({ target, sha256: item.sha256 });
  }
  const receipts = [];
  for (const [index, item] of targets.entries()) receipts.push({ ordinal: index + 1, receipt: await verifyPairedFile(item.target, { expectedSha256: item.sha256 }) });
  const sourceReferences = new Map(), artifactReferences = new Map();
  for (const { ordinal, receipt } of receipts) {
    const artifact = artifactReferences.get(receipt.exact_bundle_sha256) || [];
    artifact.push(ordinal); artifactReferences.set(receipt.exact_bundle_sha256, artifact);
    for (const role of ['primary', 'baseline']) {
      const source = sourceReferences.get(receipt[role].sha256) || [];
      source.push({ ordinal, role }); sourceReferences.set(receipt[role].sha256, source);
    }
  }
  const repeated_sources = [...sourceReferences.entries()].filter(([, references]) => references.length > 1).map(([sha256, references]) => ({ sha256, references }));
  const repeated_artifacts = [...artifactReferences.entries()].filter(([, ordinals]) => ordinals.length > 1).map(([sha256, ordinals]) => ({ sha256, ordinals }));
  return { format: 'skydash-paired-intake-receipt-v1', exact_manifest_sha256: createHash('sha256').update(raw).digest('hex'), bundle_count: receipts.length, receipts, repeated_sources, repeated_artifacts, identity_scope: 'Repeated sources compare exact CSV bytes across ordered roles, including A/B reuse within one bundle. Repeated artifacts compare exact whole-bundle bytes, including formatting and notes. Different artifact bytes can contain the same source. References are ordinal/role only, no flight/student identity or independence is inferred. No combined sample, duration, grade or completion totals.', scope: 'All listed bundles validated before this receipt was issued. Exact expected artifact digests compared in manifest order. No filenames, paths, private notes or coordinates printed. Manifest is editable, not authenticated or signed; obtain expected digests independently. This does not prove authorship, source truth, flight identity, independence, grading or readiness. No writes, upload, sharing or aircraft commands. Repeated sources across bundles are not independent flights and must not be summed.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/verify-paired-manifest.mjs MANIFEST.json\nOffline, read-only intake of1to20paired bundles within the manifest folder,20MiB total,4MiB each. Manifest up to64KiB: format skydash-paired-intake-manifest-v1, bundles array of exact path/sha256 entries. Relative paths only, no traversal, outside symlinks or duplicates. Expected full-bundle digests must come independently. All-or-nothing success receipt to stdout, no paths/private notes/coordinates, no report writes. Editable manifest/receipt, not authenticity, a signature, grades or readiness.');
  else if (args.length !== 1 || args[0].startsWith('-')) { console.error('Expected one intake manifest JSON path. Use --help.'); process.exitCode = 1; }
  else verifyPairedManifest(args[0]).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Paired intake validation failed. No batch receipt issued or files written. Check manifest format/limits, unique in-folder regular paths, independently expected exact bundle digests and nested bundle validation. Private inputs are not echoed.'); process.exitCode = 1; });
}
