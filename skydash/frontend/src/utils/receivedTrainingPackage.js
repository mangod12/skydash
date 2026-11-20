import { buildTrainingPackageManifest, checkPackageSelection } from './trainingPackageBuilder';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export async function checkReceivedTrainingPackage(manifestFile, files, expected = '') {
  if (!manifestFile || !Number.isSafeInteger(manifestFile.size) || manifestFile.size < 0 || manifestFile.size > 65536 || !Array.isArray(files) || files.length > 20 || (expected !== '' && !/^[a-fA-F0-9]{64}$/.test(expected))) throw Error('Invalid manifest, selection or independent expectation.');
  const bytes = new Uint8Array(await manifestFile.arrayBuffer());
  if (bytes.length !== manifestFile.size || bytes.length > 65536) throw Error('Changed manifest bytes.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (expected && sha256 !== expected.toLowerCase()) throw Error('Independent manifest expectation mismatch.');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  if (!exact(manifest, ['format', 'bundles']) || !['skydash-training-intake-manifest-v1', 'skydash-training-intake-manifest-v2'].includes(manifest.format) || !Array.isArray(manifest.bundles) || manifest.bundles.length !== files.length) throw Error('Invalid manifest schema or file selection.');
  const byName = new Map(files.map(file => [file.name, file]));
  if (byName.size !== files.length || byName.has(manifestFile.name)) throw Error('Duplicate or manifest/artifact filename collision.');
  const entries = manifest.bundles.map(item => {
    if (!exact(item, ['kind', 'path', 'sha256']) || (manifest.format.endsWith('-v1') && item.kind === 'case') || typeof item.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(item.sha256) || !byName.has(item.path)) throw Error('Invalid manifest entry or missing exact filename.');
    return { kind: item.kind, file: byName.get(item.path), expectedSha256: item.sha256.toLowerCase() };
  });
  checkPackageSelection(entries);
  const checked = await buildTrainingPackageManifest(entries, { requireExpected: true });
  return { exact_manifest_sha256: sha256, expected_manifest_digest_matched: Boolean(expected), bundles: checked.bundles };
}
