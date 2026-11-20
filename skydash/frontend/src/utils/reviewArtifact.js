/** Exact uploaded artifact bytes, not decoded/reformatted JSON or embedded source CSV. */
export async function readReviewArtifact(file, maxBytes, expectedDigest = '') {
  const expected = expectedDigest.trim();
  if (expected && !/^[a-fA-F0-9]{64}$/.test(expected)) throw new Error('Expected complete-file SHA-256 must be64hexadecimal characters, or blank for no external digest check.');
  if (file.size > maxBytes) throw new Error('Review artifact exceeds its file-size limit.');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error('Review artifact exceeds its file-size limit.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  if (expected && sha256 !== expected.toLowerCase()) throw new Error('Complete-file SHA-256 mismatch. Nothing replaced.');
  return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), sha256, expectedMatched: Boolean(expected) };
}
