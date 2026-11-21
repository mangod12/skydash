import { readNotebookSourceBundle } from './notebookSourceBundle';
import { readPairedReviewBundle } from './pairedReviewBundle';
import { compareCheckedNotebookReviews } from './notebookReviewComparison';
import { compareCheckedPairedReviews } from './pairedReviewComparison';
import { renderReviewComparison } from './reviewComparisonHtml';
const readers = { notebook: readNotebookSourceBundle, paired: readPairedReviewBundle };
export async function browserReviewComparison(kind, left, right) {
  if (!Object.hasOwn(readers, kind)) throw Error('Explicit supported kind required.');
  const limit = (kind === 'paired' ? 4 : 2) * 1024 * 1024;
  for (const side of [left,right]) if (!side?.file || !Number.isSafeInteger(side.file.size) || side.file.size < 1 || side.file.size > limit || typeof side.file.arrayBuffer !== 'function' || (side.expected !== undefined && side.expected !== '' && (typeof side.expected !== 'string' || !/^[a-fA-F0-9]{64}$/.test(side.expected)))) throw Error('Two bounded originals and valid optional expectations required.');
  const checked = [];
  for (const side of [left,right]) {
    const bytes = new Uint8Array(await side.file.arrayBuffer()); if (bytes.byteLength !== side.file.size || bytes.byteLength > limit) throw Error('Changed input size.');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (side.expected && sha256 !== side.expected.toLowerCase()) throw Error('Independent complete-original expectation mismatch.');
    checked.push({ opened: await readers[kind](new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)), sha256, expectedMatched: Boolean(side.expected) });
  }
  const data = (kind === 'notebook' ? compareCheckedNotebookReviews : compareCheckedPairedReviews)(...checked);
  return { html: renderReviewComparison(kind,data), leftDigest: checked[0].sha256, rightDigest: checked[1].sha256, kind };
}
