import { readReviewCase } from './reviewCase';
import { readNotebookSourceBundle } from './notebookSourceBundle';
import { readPairedReviewBundle } from './pairedReviewBundle';
const readers = { case: readReviewCase, notebook: readNotebookSourceBundle, paired: readPairedReviewBundle };
export function checkPackageSelection(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 20) throw Error('Choose 1 to 20 exported artifacts.');
  const names = new Set(); let total = 0;
  for (const { kind, file } of entries) {
    if (!Object.hasOwn(readers, kind) || !file || typeof file.name !== 'string' || !file.name.length || file.name.length > 240 || ['.', '..'].includes(file.name) || /[/\\]/.test(file.name) || names.has(file.name)) throw Error('Use supported kinds and unique plain filenames up to 240 characters. No paths or aliases.');
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > (kind === 'paired' ? 4 : 2) * 1024 * 1024) throw Error('Each case/notebook is at most 2MiB, paired artifact 4MiB.');
    total += file.size; if (total > 20 * 1024 * 1024) throw Error('Selected artifacts exceed 20MiB.');
    names.add(file.name);
  }
}
export async function buildTrainingPackageManifest(entries) {
  checkPackageSelection(entries); const bundles = [];
  for (const { kind, file } of entries) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw Error('File bytes changed during reading.');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    await readers[kind](new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
    bundles.push({ kind, path: file.name, sha256 });
  }
  return { format: 'skydash-training-intake-manifest-v2', bundles };
}
