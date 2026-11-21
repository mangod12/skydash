import { checkReceivedTrainingPackage } from './receivedTrainingPackage';
import { readReviewCase } from './reviewCase';
import { readPairedReviewBundle } from './pairedReviewBundle';
import { renderTrainingAgenda } from './trainingAgendaHtml';
const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
// No original/report text is returned outside the separately acknowledged private HTML.
export async function browserTrainingAgenda(manifestFile, files, { includePrivateReview = false, expectedSha256 = '' } = {}) {
  if (includePrivateReview !== true) throw Error('Explicit private acknowledgement required.');
  const checked = await checkReceivedTrainingPackage(manifestFile, files, expectedSha256);
  const raw = new Uint8Array(await manifestFile.arrayBuffer());
  if (raw.byteLength !== manifestFile.size || await sha(raw) !== checked.exact_manifest_sha256) throw Error('Changed complete manifest bytes.');
  const byName = new Map(files.map(file => [file.name, file])), chapters = [];
  for (const [index, item] of checked.bundles.entries()) {
    const file = byName.get(item.path), bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || await sha(bytes) !== item.sha256) throw Error('Changed complete original bytes.');
    if (item.kind === 'notebook') { chapters.push({ ordinal: index + 1, kind: item.kind, artifactDigest: item.sha256 }); continue; }
    const opened = item.kind === 'case' ? await readReviewCase(decode(bytes)) : (await readPairedReviewBundle(decode(bytes))).primary;
    const markers = opened.data.debrief.markers;
    chapters.push({ ordinal: index + 1, kind: item.kind, artifactDigest: item.sha256, sourceDigest: opened.log.sha256,
      discussed: markers.filter(marker => marker.discussed).length,
      undiscussedObservations: markers.filter(marker => !marker.discussed && marker.kind === 'Observation').length,
      items: markers.flatMap((marker, markerIndex) => !marker.discussed && ['Question', 'Follow-up'].includes(marker.kind) ? [{ timelineOrdinal: markerIndex + 1, time: marker.time_s, kind: marker.kind, text: marker.text }] : []) });
  }
  return { html: renderTrainingAgenda(chapters, checked), digest: checked.exact_manifest_sha256, bundleCount: checked.bundles.length };
}
