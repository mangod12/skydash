// Accept only the exact fixed stored ZIP emitted by the browser original packager.
// No decompression, extraction, code execution, imported report evidence or filesystem access.
import { storedZipBytes } from './storedZip';
import { browserArchiveGuide } from './browserTrainingArchive';
import { checkBrowserTrainingIntake } from './browserTrainingIntake';
import { renderTrainingIntake } from './trainingIntakeHtml';
import { browserPrivateTraining } from './browserPrivateTraining';
import { browserTrainingComparison } from './browserTrainingComparison';
const MAX = 30 * 1024 * 1024;
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const pin = value => value === '' || (typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value));
async function checkArchiveOriginals(file, { expectedArchiveSha256 = '', expectedManifestSha256 = '' } = {}) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 22 || file.size > MAX || !pin(expectedArchiveSha256) || !pin(expectedManifestSha256)) throw Error('Invalid archive or independent expectations.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength > MAX) throw Error('Changed archive bytes.');
  const archiveDigest = await sha(bytes);
  if (expectedArchiveSha256 && archiveDigest !== expectedArchiveSha256.toLowerCase()) throw Error('Independent archive expectation mismatch.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), entries = []; let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset,true) === 0x04034b50) {
    if (entries.length >= 24 || offset + 30 > bytes.length) throw Error('Invalid ZIP entry count/header.');
    const size = view.getUint32(offset+22,true), compressed = view.getUint32(offset+18,true), length = view.getUint16(offset+26,true), extra = view.getUint16(offset+28,true), start = offset+30+length;
    if (size !== compressed || !length || length > 1024 || extra !== 0 || start+size > bytes.length) throw Error('Unsupported stored ZIP entry.');
    const name = decode(bytes.subarray(offset+30,start));
    const limit = name.startsWith('training/') ? (entries.length ? 4*1024*1024 : 65536) : name === 'reports/intake-report.html' ? 8*1024*1024 : name === 'reports/validation.json' ? 1024*1024 : name === 'reports/READ-ME.txt' ? 16384 : 0;
    if (!limit || size < 1 || size > limit) throw Error('Invalid bounded ZIP entry.');
    entries.push([name,bytes.subarray(start,start+size)]);offset=start+size;
  }
  // Exact reconstruction checks CRCs, every central/local header and fixed timestamp,
  // flags, versions, lengths, offsets, names, count and absence of ZIP64/comments/trailing bytes.
  const rebuilt = storedZipBytes(entries);
  if (rebuilt.length !== bytes.length || rebuilt.some((byte,index)=>byte !== bytes[index])) throw Error('Not the exact supported stored ZIP encoding.');
  if (entries.length < 5 || entries.length > 24 || !/^training\/[^/]+$/.test(entries[0][0]) || entries.slice(0,-3).some(([name])=>!/^training\/[^/]+$/.test(name)) || entries.slice(-3).map(([name])=>name).join('|') !== 'reports/intake-report.html|reports/validation.json|reports/READ-ME.txt' || decode(entries.at(-1)[1]) !== browserArchiveGuide) throw Error('Unsupported browser handoff layout.');
  const original = ([path,data]) => ({ name:path.slice(9), size:data.byteLength, arrayBuffer:async()=>data });
  const manifest = original(entries[0]), files = entries.slice(1,-3).map(original);
  // Saved reports and receipts are bounded inert bytes, never parsed or accepted as success.
  const checked = await checkBrowserTrainingIntake(manifest, files, expectedManifestSha256);
  const declared = JSON.parse(decode(entries[0][1])).bundles;
  if (declared.some((item,index)=>item.path !== files[index]?.name)) throw Error('Original archive order differs from manifest.');
  return { manifest, files, summary: { html:renderTrainingIntake(checked), digest:checked.exact_manifest_sha256, archiveDigest, expectedArchiveDigestMatched:Boolean(expectedArchiveSha256), expectedManifestDigestMatched:Boolean(expectedManifestSha256), fileCount:entries.length, bundleCount:checked.bundle_count } };
}

export async function checkBrowserTrainingArchive(file, options = {}) {
  return (await checkArchiveOriginals(file, options)).summary;
}
// Separate opt-in API: no archive bytes are read without explicit private consent.
// Original slices are kept inside this call, never exposed to UI or used as received report evidence.
export async function privateBrowserTrainingArchive(file, { includePrivateReview = false, ...options } = {}) {
  if (includePrivateReview !== true) throw Error('Explicit private acknowledgement required.');
  const { manifest, files, summary } = await checkArchiveOriginals(file, options);
  const packet = await browserPrivateTraining(manifest, files, { includePrivateReview: true, expectedSha256: options.expectedManifestSha256 || '' });
  return { ...summary, privateHtml: packet.html };
}

// Each side is independently checked; no private packet rendering or raw-original exposure.
export async function compareBrowserTrainingArchives(left, right) {
  const a = await checkArchiveOriginals(left?.file, left?.options);
  const b = await checkArchiveOriginals(right?.file, right?.options);
  const compared = await browserTrainingComparison(
    { manifest: a.manifest, files: a.files, expected: left.options?.expectedManifestSha256 || '' },
    { manifest: b.manifest, files: b.files, expected: right.options?.expectedManifestSha256 || '' }
  );
  return { ...compared, left: { archiveDigest: a.summary.archiveDigest, manifestDigest: a.summary.digest, expectedArchiveDigestMatched: a.summary.expectedArchiveDigestMatched, expectedManifestDigestMatched: a.summary.expectedManifestDigestMatched }, right: { archiveDigest: b.summary.archiveDigest, manifestDigest: b.summary.digest, expectedArchiveDigestMatched: b.summary.expectedArchiveDigestMatched, expectedManifestDigestMatched: b.summary.expectedManifestDigestMatched } };
}
