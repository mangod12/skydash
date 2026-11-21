import { privatePacketOrdinals } from './privatePacketOrdinals';
import { checkReceivedTrainingPackage } from './receivedTrainingPackage';
import { browserPrivateDebrief } from './browserPrivateDebrief';
import { renderPrivateTraining } from './privateTrainingHtml';
export async function browserPrivateTraining(manifestFile, files, { includePrivateReview = false, expectedSha256 = '', selectedOrdinals = null } = {}) {
  if (includePrivateReview !== true) throw Error('Explicit private acknowledgement required.');
  const requested = privatePacketOrdinals(selectedOrdinals);
  const checked = await checkReceivedTrainingPackage(manifestFile, files, expectedSha256);
  const ordinals = privatePacketOrdinals(requested, checked.bundles.length);
  const raw = new Uint8Array(await manifestFile.arrayBuffer());
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');
  if (raw.byteLength !== manifestFile.size || digest !== checked.exact_manifest_sha256) throw Error('Changed complete manifest bytes.');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw)), byName = new Map(files.map(file => [file.name, file]));
  const reports = [], sources = new Map(), artifacts = new Map(); let expanded = 0;
  for (const [index, item] of checked.bundles.entries()) {
    if (ordinals && !ordinals.includes(index + 1)) continue;
    const report = await browserPrivateDebrief(item.kind, byName.get(item.path), { includePrivateReview: true, expectedSha256: item.sha256 });
    expanded += new TextEncoder().encode(report.html).byteLength; if (expanded > 16 * 1024 * 1024) throw Error('Private packet exceeds output bound.');
    reports.push(report.html); const ordinal = index + 1;
    artifacts.set(item.sha256, [...(artifacts.get(item.sha256) || []), ordinal]);
    for (const [i, source] of report.sources.entries()) sources.set(source.sha256, [...(sources.get(source.sha256) || []), { ordinal, role: item.kind === 'paired' ? (i ? 'baseline' : 'primary') : 'source' }]);
  }
  const evidence = { bundle_count: checked.bundles.length, repeated_sources: [...sources].filter(([, refs]) => refs.length > 1).map(([sha256, references]) => ({ sha256, references })), repeated_artifacts: [...artifacts].filter(([, ordinals]) => ordinals.length > 1).map(([sha256, ordinals]) => ({ sha256, ordinals })) };
  return { html: renderPrivateTraining(manifest, evidence, reports, { digest, expectedSha256: expectedSha256 || null, selectedOrdinals: ordinals }), digest, kind: 'package' };
}
