#!/usr/bin/env node
// Inspect only the exact stored-ZIP format emitted by the trusted packager. Never extract or execute.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { storedZip } from './package-training-intake.mjs';
import { validateDistributionInventory } from './offline-review-distribution.mjs';
const MAX_ARCHIVE = 17 * 1024 * 1024;
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
export function inspectStoredDistribution(bytes, { expectedArchiveSha256 = '', expectedManifestSha256 = '' } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_ARCHIVE || (expectedArchiveSha256 !== '' && !pin(expectedArchiveSha256)) || (expectedManifestSha256 !== '' && !pin(expectedManifestSha256))) throw Error('Invalid archive or expectation.');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (expectedArchiveSha256 && digest !== expectedArchiveSha256.toLowerCase()) throw Error('Independent archive expectation mismatch.');
  const entries = []; let offset = 0;
  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    if (entries.length >= 5 || offset + 30 > bytes.length) throw Error('Invalid entry count or header.');
    const compressed = bytes.readUInt32LE(offset + 18), size = bytes.readUInt32LE(offset + 22), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    if (compressed !== size || nameLength < 1 || nameLength > 128 || extraLength !== 0 || size < 1 || size > 8 * 1024 * 1024 || offset + 30 + nameLength + size > bytes.length) throw Error('Unsupported ZIP entry.');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    if (!(name === 'site/offline-review.html' || name === 'START.txt' || name === 'distribution.json' || /^site\/assets\/offline-review-[A-Za-z0-9_-]{8}\.(js|css)$/.test(name)) || entries.some(([path]) => path === name)) throw Error('Unsupported or repeated ZIP path.');
    const limit = name === 'START.txt' ? 16384 : name === 'distribution.json' || name === 'site/offline-review.html' ? 65536 : 8 * 1024 * 1024;
    if (size > limit) throw Error('Entry too large.');
    const start = offset + 30 + nameLength; entries.push([name, bytes.subarray(start, start + size)]); offset = start + size;
  }
  // Reconstruct the complete fixed encoding. This checks central-directory agreement,
  // every CRC/size/offset/flag/method/timestamp, no extras/comments/trailing bytes or ZIP64.
  if (entries.length !== 5 || entries[4][0] !== 'distribution.json' || !storedZip(entries).equals(bytes)) throw Error('Not an exact supported stored distribution ZIP.');
  const html = new TextDecoder('utf-8', { fatal: true }).decode(entries[0][1]);
  if (!html.includes('<title>SkyDash - Standalone Recorded Review</title>') || !html.includes("connect-src 'none'") || !html.includes("worker-src 'none'") || entries.slice(1, 3).some(([name]) => !html.includes('./' + name.slice(5)))) throw Error('Unsupported standalone entry.');
  if (entries.slice(0, 3).reduce((sum, [, data]) => sum + data.length, 0) > 16 * 1024 * 1024) throw Error('Build too large.');
  const checked = validateDistributionInventory(entries.slice(0, 4), entries[4][1], expectedManifestSha256);
  return { ...checked, format: 'skydash-standalone-archive-check-v1', exact_archive_sha256: digest, expected_archive_digest_matched: Boolean(expectedArchiveSha256), archive_bytes: bytes.length, scope: checked.scope + ' Archive bytes were checked in memory without decompression or filesystem extraction. Only the exact fixed stored-ZIP encoding from this packager is supported; arbitrary ZIPs are refused. Matching expected bytes does not make executable assets safe. Recheck extracted files separately before choosing to serve trusted code.' };
}
export async function verifyOfflineArchive(filename, options = {}) {
  for (const value of [options.expectedArchiveSha256, options.expectedManifestSha256]) if (value !== undefined && value !== '' && !pin(value)) throw Error('Invalid expectation.');
  const path = resolve(filename), canonical = await realpath(path), before = await lstat(path);
  if (canonical !== path || !before.isFile() || before.isSymbolicLink() || before.size < 22 || before.size > MAX_ARCHIVE) throw Error('Invalid archive file.');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat(); if (!info.isFile() || info.size < 22 || info.size > MAX_ARCHIVE) throw Error('Invalid size.');
    const buffer = Buffer.alloc(info.size + 1); let length = 0;
    while (length < buffer.length) { const result = await file.read(buffer, length, buffer.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
    if (length !== info.size || await realpath(path) !== path) throw Error('Changed archive.');
    return inspectStoredDistribution(buffer.subarray(0, length), options);
  } finally { await file.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/verify-offline-archive.mjs ORIGINAL.zip [--expect-archive-sha256 HEX] [--expect-manifest-sha256 HEX]\nRead-only bounded17MiB exact stored-ZIP distribution inspection, using a separate trusted checkout. Optional independent whole-archive pin checked before ZIP parsing; optional raw inventory pin checked before JSON parsing. Strict generated layout, CRC/header/central agreement and exact file inventory. No decompression, extraction, execution, install, server, file writes or sharing. Refuses arbitrary/compressed/ZIP64/encrypted/commented ZIPs. Unsigned executable code stays untrusted without your independent source/build assessment. Recheck extracted files separately.');
  else {
    let valid = args.length > 0 && !args[0].startsWith('-'); const options = {}, seen = new Set();
    for (let i = 1; i < args.length && valid; i++) { const flag = args[i]; if (seen.has(flag) || !['--expect-archive-sha256', '--expect-manifest-sha256'].includes(flag) || !pin(args[i + 1])) { valid = false; break; } seen.add(flag); options[flag === '--expect-archive-sha256' ? 'expectedArchiveSha256' : 'expectedManifestSha256'] = args[++i]; }
    if (!valid) { console.error('Expected one original ZIP and supported independent digest options. Use --help.'); process.exitCode = 1; }
    else verifyOfflineArchive(args[0], options).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Standalone archive refused. No success receipt or extraction. Check trusted original stored-ZIP layout, bounds, CRC, exact inventory and independent expectations. Private paths/content not echoed. Nothing executed, served, installed or written.'); process.exitCode = 1; });
  }
}
