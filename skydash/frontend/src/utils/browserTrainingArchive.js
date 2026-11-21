import { checkBrowserTrainingIntake } from './browserTrainingIntake';
import { renderTrainingIntake } from './trainingIntakeHtml';
import { storedZipBytes } from './storedZip';
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
export const browserArchiveGuide = `SKYDASH / SENSITIVE ORIGINAL BROWSER HANDOFF

Contains exact original training manifest and every listed whole original JSON file, including private source coordinates, notes, criteria and readings. This is not a redacted archive. ZIP is unencrypted and unsigned. No upload, sharing or automatic storage performed. Confirm the audience and use an appropriate secure channel separately.

Extract into a new private folder with your own trusted archive tool. The original manifest and its listed originals are together under training/. Revalidate them with a separate trusted SkyDash checkout and current nested validators. Never trust co-delivered HTML or receipts, or execute received code. Obtain complete-file expectations through a separate trusted route. Generated hashes describe bytes, not authenticated authorship/custody, source truth, verified units/datum, OEM compatibility, flight/student identity, grades, completion, certification or readiness.

reports/intake-report.html is privacy-reduced, not anonymized. reports/validation.json is an editable locally generated projection, not independent evidence or a reopenable workspace. No conversion lineage was supplied or checked. No readable private discussion packet is added; originals still contain private data. Preserve original mapping sources/recipes, baseline sources and all other excluded work separately as appropriate to each original's exclusions. No complete workspace backup or handoff certificate. Repeated source/copy occurrences are never independent flights or completion totals. No combined sample/span/grade/completion totals. Every interval remains unsampled; unknown is not zero.

Archive timestamps are fixed, not recording, observation or creation times. Only the explicit selected originals plus these fresh reports and guide are included. No replay opening, pause/seek, source repairs, annotation transfer, original changes or aircraft commands. Verify saved bytes, preserve originals and stop treating editable unsigned output as a trusted receipt.
`;
export async function browserTrainingArchive(manifestFile, files, { expectedSha256 = '', includeSensitiveOriginals = false } = {}) {
  // Consent applies before any file reads, including refused attempts.
  if (includeSensitiveOriginals !== true) throw Error('Fresh whole-original sensitive archive acknowledgement required.');
  const checked = await checkBrowserTrainingIntake(manifestFile, files, expectedSha256);
  const html = renderTrainingIntake(checked);
  const raw = new Uint8Array(await manifestFile.arrayBuffer());
  if (raw.byteLength !== manifestFile.size || await digest(raw) !== checked.exact_manifest_sha256) throw Error('Changed manifest bytes.');
  const entries = [['training/' + manifestFile.name, raw]], byName = new Map(files.map(file => [file.name, file]));
  for (const item of JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw)).bundles) {
    const file = byName.get(item.path), bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || await digest(bytes) !== item.sha256.toLowerCase()) throw Error('Changed original bytes.');
    entries.push(['training/' + item.path, bytes]);
  }
  const validation = { ...checked, scope: 'Fresh current nested validation and byte pins of every selected original before archive preparation. Editable browser projection, not imported evidence, authentication, source truth, complete backup, completion or readiness. No conversion lineage check. Exact originals contain private data; this unencrypted archive is not redacted. No upload, sharing, replay changes or aircraft commands.' };
  entries.push(['reports/intake-report.html', html], ['reports/validation.json', JSON.stringify(validation, null, 2)], ['reports/READ-ME.txt', browserArchiveGuide]);
  const size = entries.reduce((sum, [, bytes]) => sum + (typeof bytes === 'string' ? new TextEncoder().encode(bytes).byteLength : bytes.byteLength), 0);
  if (size > 30 * 1024 * 1024) throw Error('Archive output exceeds bound.');
  const bytes = storedZipBytes(entries);
  if (bytes.byteLength > 30 * 1024 * 1024) throw Error('Archive output exceeds bound.');
  return { bytes, html, digest: checked.exact_manifest_sha256, archiveDigest: await digest(bytes), fileCount: entries.length, bundleCount: checked.bundle_count };
}
