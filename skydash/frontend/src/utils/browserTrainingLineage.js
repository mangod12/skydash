import { checkBrowserTrainingIntake } from './browserTrainingIntake';
import { browserConversionReproduction } from './browserConversionReproduction';
import { linkCheckedTrainingConversions } from './trainingLineageLinks';
import { renderTrainingIntake } from './trainingIntakeHtml';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const plain = value => typeof value === 'string' && value.length > 0 && value.length <= 240 && !['.','..'].includes(value) && !/[/\\]/.test(value);
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
export async function browserTrainingLineage(training, lineage, { confirmedWGS84 = false, requireAllReviewSources = false } = {}) {
  if (confirmedWGS84 !== true || typeof requireAllReviewSources !== 'boolean') throw Error('Fresh explicit confirmation for all originals required before any reads.');
  const manifest = lineage?.manifest, files = lineage?.files, expected = lineage?.expected ?? '';
  if (!manifest || !Number.isSafeInteger(manifest.size) || manifest.size < 1 || manifest.size > 65536 || !Array.isArray(files) || !files.length || files.length > 60 || (expected !== '' && !pin(expected))) throw Error('Bounded explicit lineage selection required.');
  const byName = new Map(); let total = 0;
  for (const file of files) {
    if (!file || !plain(file.name) || file.name === manifest.name || byName.has(file.name) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 1048576) throw Error('Unique exact plain filenames and bounded files required.');
    total += file.size; if (total > 20 * 1024 * 1024) throw Error('Lineage data exceeds20MiB.'); byName.set(file.name, file);
  }
  const bytes = new Uint8Array(await manifest.arrayBuffer());
  if (bytes.byteLength !== manifest.size) throw Error('Changed lineage manifest size.');
  const digest = await hash(bytes); if (expected && digest !== expected.toLowerCase()) throw Error('Independent lineage manifest expectation mismatch.');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  if (!exact(data, ['format','conversions']) || data.format !== 'skydash-training-lineage-manifest-v1' || !Array.isArray(data.conversions) || !data.conversions.length || data.conversions.length > 20) throw Error('Invalid lineage manifest.');
  const used = new Set(), entries = [];
  for (const entry of data.conversions) {
    if (!exact(entry, ['original','recipe','converted'])) throw Error('Invalid conversion entry.');
    const selected = {}, pins = {};
    for (const role of ['original','recipe','converted']) {
      const item = entry[role];
      if (!exact(item, ['path','sha256']) || !plain(item.path) || !pin(item.sha256) || used.has(item.path) || !byName.has(item.path)) throw Error('Missing, duplicate or unsupported original file reference.');
      const file = byName.get(item.path); if (file.size > (role === 'recipe' ? 65536 : 1048576)) throw Error('Role size exceeded.');
      used.add(item.path); selected[role] = file; pins[role] = item.sha256;
    }
    entries.push({ selected, pins });
  }
  if (used.size !== files.length) throw Error('All and only listed lineage originals required.');
  const conversions = [];
  for (const [index, { selected, pins }] of entries.entries()) conversions.push({ ordinal: index + 1, receipt: await browserConversionReproduction(selected, { confirmedWGS84: true, expected: pins }) });
  const checked = await checkBrowserTrainingIntake(training.manifest, training.files, training.expected ?? '');
  // Preserve the checked in-memory conversion snapshots, and repin the manifest before linking.
  const again = new Uint8Array(await manifest.arrayBuffer()); if (again.byteLength !== manifest.size || await hash(again) !== digest) throw Error('Changed lineage manifest.');
  const links = linkCheckedTrainingConversions(checked, conversions, { lineageDigest: digest, expectedMatched: Boolean(expected), requireAllReviewSources });
  return { html: renderTrainingIntake(checked, links), trainingDigest: checked.exact_manifest_sha256, lineageDigest: digest, allLinked: links.all_review_sources_linked };
}
