import { readPrivateDebrief } from './privateDebriefReport';
import { renderPrivateDebrief } from './privateDebriefHtml';
export async function browserPrivateDebrief(kind, file, { includePrivateReview = false, expectedSha256 = '' } = {}) {
  if (includePrivateReview !== true || !['case', 'notebook', 'paired'].includes(kind) || !file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > (kind === 'paired' ? 4 : 2) * 1024 * 1024 || (expectedSha256 !== '' && !/^[a-fA-F0-9]{64}$/.test(expectedSha256))) throw Error('Explicit kind, bounded original and private acknowledgement required.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw Error('Changed original bytes.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (expectedSha256 !== '' && digest !== expectedSha256.toLowerCase()) throw Error('Independent complete-original expectation mismatch.');
  const data = await readPrivateDebrief(kind, new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  return { html: renderPrivateDebrief(kind, data, { digest, expectedSha256: expectedSha256 || null }), digest, kind, sources: data.sources };
}
