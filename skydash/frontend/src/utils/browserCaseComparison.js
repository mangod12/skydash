import { readReviewCase, MAX_CASE_BYTES } from './reviewCase';
import { compareCheckedReviewCases } from './reviewCaseComparison';
import { renderReviewCaseComparison } from './reviewCaseComparisonHtml';
const valid = side => side && side.file && Number.isSafeInteger(side.file.size) && side.file.size > 0 && side.file.size <= MAX_CASE_BYTES && typeof side.file.arrayBuffer === 'function' && (side.expected === undefined || side.expected === '' || typeof side.expected === 'string' && /^[a-fA-F0-9]{64}$/.test(side.expected));
async function checked(side) {
  const bytes = new Uint8Array(await side.file.arrayBuffer());
  if (bytes.byteLength !== side.file.size || bytes.byteLength > MAX_CASE_BYTES) throw Error('Changed case size.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (side.expected && sha256 !== side.expected.toLowerCase()) throw Error('Independent complete-case expectation mismatch.');
  return { ...await readReviewCase(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)), sha256, expectedMatched: Boolean(side.expected) };
}
export async function browserCaseComparison(left, right) {
  // Preflight both files before reading either. Validate both actual originals before one result.
  if (!valid(left) || !valid(right)) throw Error('Two bounded original cases and valid independent optional expectations required.');
  const a = await checked(left), b = await checked(right), data = compareCheckedReviewCases(a, b);
  return { html: renderReviewCaseComparison(data), leftDigest: a.sha256, rightDigest: b.sha256, sourceEqual: data.source_bytes_equal };
}
