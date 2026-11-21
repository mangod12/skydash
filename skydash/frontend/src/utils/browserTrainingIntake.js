import { checkReceivedTrainingPackage } from './receivedTrainingPackage';
import { readReviewCase } from './reviewCase';
import { readNotebookSourceBundle } from './notebookSourceBundle';
import { readPairedReviewBundle } from './pairedReviewBundle';
import { renderTrainingIntake } from './trainingIntakeHtml';
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const source = log => ({ sha256: log.sha256, samples: log.samples.length, start_s: 0, end_s: log.samples.at(-1).time_s });
async function project(kind, bytes) {
  const text = decode(bytes);
  if (kind === 'paired') {
    const opened = await readPairedReviewBundle(text);
    return { primary: source(opened.primary.log), baseline: source(opened.comparison.baseline), included_reviews: { primary_instructor_markers: opened.primary.data.debrief.markers.length, evaluated_envelope: Boolean(opened.primary.data.envelope), applied_manual_anchors: Boolean(opened.comparison.alignment) } };
  }
  const { data, log } = await (kind === 'case' ? readReviewCase : readNotebookSourceBundle)(text);
  if (kind === 'case') return { source: source(log), included_reviews: { instructor_markers: data.debrief.markers.length, evaluated_envelope: Boolean(data.envelope) } };
  const copies = data.notebook.windows.map((window, index) => {
    const rows = log.samples.slice(window.first_row - 1, window.last_row);
    return { ordinal: index + 1, first_row: window.first_row, last_row: window.last_row, samples: rows.length, intervals_over_5s: rows.slice(1).filter((row, i) => row.time_s - rows[i].time_s > 5).length, channels: Object.fromEntries(['altitude_m', 'ground_speed_m_s', 'battery_pct'].map(key => [key, { known: rows.filter(row => row[key] !== null).length, missing: rows.filter(row => row[key] === null).length }])) };
  });
  return { source: source(log), saved_copy_count: copies.length, copies };
}
export async function checkBrowserTrainingIntake(manifestFile, files, expected = '') {
  const checked = await checkReceivedTrainingPackage(manifestFile, files, expected);
  const raw = new Uint8Array(await manifestFile.arrayBuffer());
  if (raw.byteLength !== manifestFile.size || await digest(raw) !== checked.exact_manifest_sha256) throw Error('Changed manifest bytes.');
  const manifest = JSON.parse(decode(raw)), byName = new Map(files.map(file => [file.name, file])), receipts = [], sources = new Map(), artifacts = new Map();
  for (const [index, item] of checked.bundles.entries()) {
    const file = byName.get(item.path), bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || await digest(bytes) !== item.sha256) throw Error('Changed artifact bytes.');
    const receipt = { exact_bundle_sha256: item.sha256, ...await project(item.kind, bytes) }, ordinal = index + 1;
    receipts.push({ ordinal, kind: item.kind, receipt });
    artifacts.set(item.sha256, [...(artifacts.get(item.sha256) || []), ordinal]);
    for (const role of item.kind === 'paired' ? ['primary', 'baseline'] : ['source']) sources.set(receipt[role].sha256, [...(sources.get(receipt[role].sha256) || []), { ordinal, role }]);
  }
  const data = { format: manifest.format.replace('manifest', 'receipt'), exact_manifest_sha256: checked.exact_manifest_sha256, expected_manifest_digest_matched: checked.expected_manifest_digest_matched, bundle_count: receipts.length, receipts, repeated_sources: [...sources].filter(([, references]) => references.length > 1).map(([sha256, references]) => ({ sha256, references })), repeated_artifacts: [...artifacts].filter(([, ordinals]) => ordinals.length > 1).map(([sha256, ordinals]) => ({ sha256, ordinals })) };
  return data;
}

export async function browserTrainingIntake(manifestFile, files, expected = '') {
  const data = await checkBrowserTrainingIntake(manifestFile, files, expected);
  return { html: renderTrainingIntake(data), digest: data.exact_manifest_sha256 };
}
