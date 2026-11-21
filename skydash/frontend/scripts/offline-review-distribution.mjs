#!/usr/bin/env node
// Explicit bounded build distribution. Never execute, extract, install or serve inputs.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { storedZip } from './package-training-intake.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const asset = /^offline-review-[A-Za-z0-9_-]{8}\.(js|css)$/;
const scope = 'Exact selected static-file bytes only. Editable unsigned executable assets and manifest are not authenticated authorship, trusted code, supply-chain attestation, malware inspection, certified air gap, telemetry truth, training completion or readiness. No extraction, execution, serving, install, network, upload or sharing performed. Record expected digests independently through a trusted route; a co-delivered manifest cannot authenticate itself. Keep inputs unchanged during checking and inspect the trusted source/build separately.';
export const distributionGuide = `SKYDASH / STANDALONE RECORDED REVIEW DISTRIBUTION

This ZIP contains only the explicitly selected bounded static build plus this guide and a byte inventory. No recordings, training artifacts, libraries, dependencies or license notices are added. Retain the trusted checkout and license notices separately. Assets are executable, editable and unsigned. An inventory match is not trusted code, a signature, malware clearance or a certified air-gap boundary.

Extract with your own trusted archive tool into a new private directory. Extraction is not performed by SkyDash. Keep originals unchanged. Before serving, use the verification command from a separate trusted SkyDash checkout against the extracted directory. Obtain the expected manifest SHA-256 through a separate trusted route. Do not run a verifier supplied by an untrusted distribution. Verification never executes these assets and does not make untrusted JavaScript safe.

After choosing to trust the source/build yourself, serve ONLY the extracted site directory on loopback with a trusted static server. Do not serve the archive root, checkout, recordings or a parent directory. Open offline-review.html on that local origin. Direct file:// opening is unsupported. Keep the local server available for opening/reloading and stop it when finished. No installer, service worker or automatic update is included. Browser extensions, other software and external links remain outside the page's control.

The standalone profile has no configured backend or inherited account and uses blank maps and local fonts. This guide is not an independent test of those properties. Preserve private recordings, downloads and excluded work separately. Explicit device-local libraries depend on browser profile and origin and are not backups. Review output audiences and use approved transport yourself. No complete workspace backup, completion, certification or readiness claim.
`;
async function directory(path) {
  const absolute = resolve(path), info = await lstat(absolute);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Expected real directory.');
  return realpath(absolute);
}
async function boundedFile(root, path, limit = 8 * 1024 * 1024) {
  const target = join(root, path), canonical = await realpath(target), before = await lstat(target);
  if (canonical !== target || !before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > limit) throw Error('Invalid path or size.');
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat(); if (!info.isFile() || info.size < 1 || info.size > limit) throw Error('Invalid file size.');
    const buffer = Buffer.alloc(info.size + 1); let length = 0;
    while (length < buffer.length) { const read = await file.read(buffer, length, buffer.length - length, null); if (!read.bytesRead) break; length += read.bytesRead; }
    const bytes = buffer.subarray(0, length); if (bytes.length !== info.size || bytes.length > limit || await realpath(target) !== target) throw Error('Changed file.');
    return bytes;
  } finally { await file.close(); }
}
async function names(root, expected) {
  const actual = (await readdir(root)).sort(); if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw Error('Unexpected or missing files.');
}
async function siteEntries(root) {
  await names(root, ['offline-review.html', 'assets']); await directory(join(root, 'assets'));
  const files = (await readdir(join(root, 'assets'))).sort();
  if (files.length !== 2 || files.some(name => !asset.test(name)) || !files.some(name => name.endsWith('.js')) || !files.some(name => name.endsWith('.css'))) throw Error('Unsupported build layout.');
  const entries = [['site/offline-review.html', await boundedFile(root, 'offline-review.html', 65536)]];
  for (const name of files) entries.push(['site/assets/' + name, await boundedFile(root, 'assets/' + name)]);
  const html = new TextDecoder('utf-8', { fatal: true }).decode(entries[0][1]);
  if (!html.includes('<title>SkyDash - Standalone Recorded Review</title>') || !html.includes("connect-src 'none'") || !html.includes("worker-src 'none'") || files.some(name => !html.includes('./assets/' + name))) throw Error('Unsupported standalone entry.');
  if (entries.reduce((sum, [, bytes]) => sum + bytes.length, 0) > 16 * 1024 * 1024) throw Error('Build too large.');
  return entries;
}
export async function writeOfflineDistribution(buildPath, outputPath) {
  const root = await directory(buildPath), output = resolve(outputPath), canonicalOutput = join(await realpath(dirname(output)), basename(output)), child = relative(root, canonicalOutput);
  if (!child || (!isAbsolute(child) && child !== '..' && !child.startsWith('..' + sep))) throw Error('Output must be outside input.');
  const entries = await siteEntries(root); entries.push(['START.txt', Buffer.from(distributionGuide)]);
  const manifest = Buffer.from(JSON.stringify({ format: 'skydash-standalone-distribution-v1', files: entries.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })) }, null, 2) + '\n');
  const bytes = storedZip([...entries, ['distribution.json', manifest]]), file = await open(output, 'wx', 0o600);
  try { await file.writeFile(bytes); } finally { await file.close(); }
  return { format: 'skydash-standalone-distribution-write-v1', exact_archive_sha256: hash(bytes), exact_manifest_sha256: hash(manifest), archive_bytes: bytes.length, file_count: entries.length + 1, scope };
}
export async function verifyOfflineDistribution(input, expected = '') {
  if (expected !== '' && !pin(expected)) throw Error('Invalid independent expectation.');
  const root = await directory(input); await names(root, ['site', 'START.txt', 'distribution.json']); await directory(join(root, 'site'));
  const raw = await boundedFile(root, 'distribution.json', 65536), digest = hash(raw);
  if (expected && digest !== expected.toLowerCase()) throw Error('Independent manifest expectation mismatch.');
  const entries = await siteEntries(join(root, 'site')); entries.push(['START.txt', await boundedFile(root, 'START.txt', 16384)]);
  return validateDistributionInventory(entries, raw, expected);
}
export function validateDistributionInventory(entries, raw, expected = '') {
  if (expected !== '' && !pin(expected)) throw Error('Invalid independent expectation.');
  const digest = hash(raw); if (expected && digest !== expected.toLowerCase()) throw Error('Independent manifest expectation mismatch.');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw));
  if (!exact(manifest, ['format', 'files']) || manifest.format !== 'skydash-standalone-distribution-v1' || !Array.isArray(manifest.files) || manifest.files.length !== 4 || entries.length !== 4) throw Error('Invalid inventory.');
  const assets = entries.slice(1, 3).map(([path]) => path);
  if (entries[0][0] !== 'site/offline-review.html' || entries[3][0] !== 'START.txt' || assets.some(path => !/^site\/assets\/offline-review-[A-Za-z0-9_-]{8}\.(js|css)$/.test(path)) || assets[0] >= assets[1] || !assets.some(path => path.endsWith('.js')) || !assets.some(path => path.endsWith('.css'))) throw Error('Unsupported fixed layout.');
  if (!entries[3][1].equals(Buffer.from(distributionGuide))) throw Error('Guide mismatch.');
  for (const [i, [path, bytes]] of entries.entries()) {
    const item = manifest.files[i]; if (!exact(item, ['path', 'bytes', 'sha256']) || item.path !== path || item.bytes !== bytes.length || !pin(item.sha256) || item.sha256.toLowerCase() !== hash(bytes)) throw Error('Inventory mismatch.');
  }
  return { format: 'skydash-standalone-distribution-check-v1', exact_manifest_sha256: digest, expected_manifest_digest_matched: Boolean(expected), file_count: entries.length + 1, scope };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), help = 'Usage: node scripts/offline-review-distribution.mjs create BUILD_DIR --output NEW.zip\n       node scripts/offline-review-distribution.mjs verify EXTRACTED_DIR [--expect-manifest-sha256 HEX]\nExplicit bounded current single-JS/single-CSS standalone build only. New mode0600 ZIP, never overwrite; verify extracted files using this separate trusted checkout, never execute or extract them. Reject extra files and symlinks. Keep inputs unchanged. Outputs contain editable executable code, not recordings or a full backup. Independently obtain expected hashes. Byte agreement is not authenticity or trusted code. A failed write may leave an incomplete new output; no success receipt is issued.';
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log(help);
  else {
    const validPath = value => typeof value === 'string' && value.length > 0 && !value.startsWith('-');
    const create = args[0] === 'create' && args.length === 4 && validPath(args[1]) && args[2] === '--output' && validPath(args[3]);
    const verify = args[0] === 'verify' && validPath(args[1]) && (args.length === 2 || (args.length === 4 && args[2] === '--expect-manifest-sha256' && pin(args[3])));
    if (!create && !verify) { console.error('Expected explicit create/verify command and supported options. Use --help.'); process.exitCode = 1; }
    else (create ? writeOfflineDistribution(args[1], args[3]) : verifyOfflineDistribution(args[1], args[3] || '')).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Standalone distribution refused. No success receipt. Check trusted original build, exact layout, file bounds, symlinks, independent pin and new output path. Private paths/content not echoed. No assets executed or extracted. A failed write may leave an incomplete new output.'); process.exitCode = 1; });
  }
}
