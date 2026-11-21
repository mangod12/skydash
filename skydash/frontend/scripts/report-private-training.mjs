#!/usr/bin/env node
// Sensitive packet from explicitly listed originals, never imported success receipts.
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
import { reportPrivateDebrief, readBoundedPrivateOriginal } from './report-private-debrief.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export async function reportPrivateTraining(filename, { includePrivateReview = false, expectedSha256 = null } = {}) {
  if (includePrivateReview !== true || (expectedSha256 !== null && !pin(expectedSha256))) throw Error('Explicit private acknowledgement and supported expectation required.');
  const path = resolve(filename), raw = await readBoundedPrivateOriginal(path, 65536), digest = hash(raw);
  if (expectedSha256 !== null && digest !== expectedSha256.toLowerCase()) throw Error('Independent manifest expectation mismatch.');
  // Pin the checked raw manifest, preventing a second manifest read from changing selection.
  const checked = await verifyTrainingManifest(path, { expectedSha256: digest });
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw));
  const root = dirname(path), chapters = []; let css = '', size = 0;
  for (const [index, item] of manifest.bundles.entries()) {
    const target = resolve(root, item.path), canonical = await realpath(target), child = relative(root, canonical);
    if (canonical !== target || !child || isAbsolute(child) || child === '..' || child.startsWith('..' + sep)) throw Error('Strict in-folder regular originals required.');
    // Each individual report pins the original bytes again before parsing all nested models.
    const report = await reportPrivateDebrief(item.kind, target, { includePrivateReview: true, expectedSha256: item.sha256 });
    const start = report.indexOf('<main>'), end = report.lastIndexOf('</main>');
    if (start < 0 || end <= start) throw Error('Unsupported trusted report layout.');
    if (!css) css = report.slice(report.indexOf('<style>') + 7, report.indexOf('</style>'));
    const prefix = `bundle-${index + 1}-`, body = report.slice(start + 6, end).replace(/(id|aria-labelledby)="([a-z0-9-]+)"/g, (_all, attr, value) => `${attr}="${prefix}${value}"`).replace(/href="#([a-z0-9-]+)"/g, (_all, value) => `href="#${prefix}${value}"`);
    const chapter = `<article class="bundle" aria-labelledby="bundle-${index + 1}"><h2 id="bundle-${index + 1}">Bundle ${index + 1}: ${escape(item.kind)}</h2>${body}</article>`;
    size += Buffer.byteLength(chapter); if (size > 16 * 1024 * 1024) throw Error('Private packet exceeds output bound.');
    chapters.push(chapter);
  }
  const reuse = checked.repeated_sources.length ? checked.repeated_sources.map(source => `<li><code>${source.sha256}</code><p>${source.references.map(ref => `Bundle ${ref.ordinal} ${ref.role}`).join('; ')}</p></li>`).join('') : '<li>No exact CSV source hash is repeated across the selected source roles.</li>';
  const repeated = checked.repeated_artifacts.length ? checked.repeated_artifacts.map(item => `<li><code>${item.sha256}</code><p>${item.ordinals.map(ordinal => `Bundle ${ordinal}`).join('; ')}</p></li>`).join('') : '<li>No exact complete-artifact hash is repeated.</li>';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>SkyDash private training discussion packet</title><style>${css}
.bundle{border-top:3px solid #60778b;padding-top:24px;margin-top:40px}.bundle>h2{font-size:27px}li{margin:12px 0}h3{font-size:17px}@media print{.bundle{break-before:page;margin:0;padding-top:10px}.bundle>h2{font-size:21px}.packet-index{break-before:auto}footer{font-size:9px;line-height:1.4}}
</style></head><body><main><header><p class="eyebrow">SKYDASH / SENSITIVE ORIGINAL PACKAGE DISCUSSION</p><h1>Private training discussion packet</h1><p>${checked.bundle_count} explicitly listed original bundles, in manifest order. These are artifact references, not independent flights, students or completions.</p></header><div class="notice" role="note"><strong>Private reviewer text, coordinates and readings included.</strong><p>You explicitly requested sensitive output for every listed original. This is not the privacy-reduced intake report. Original section privacy statements apply only within that section, not to other chapters. Labels, notes, source metadata, markers, criteria and comparison anchors can be included. Review audiences and approved transport yourself. No automatic sharing.</p><p>Editable unsigned discussion output, not authenticated authorship/custody, source truth, a source backup, reopenable workspace, complete handoff, grades, completion, certification, flight clearance or readiness evidence. Manifest order is not chronology. All intervals remain unsampled, unknown is not zero, and repeated artifacts/sources/copies are never independent training evidence.</p></div><section class="evidence packet-index"><h2>Manifest and selection evidence</h2><p>${expectedSha256 === null ? 'No independent complete-manifest digest supplied.' : 'Caller-supplied expected complete-manifest digest matched.'} Per-artifact expectations matched before nested parsing. Obtain all expectations through a trusted independent route; hashes copied from the received package do not authenticate it.</p><code>${digest}</code><p>Manifest version ${manifest.format.endsWith('-v2') ? '2' : '1'}. Current original source/model/review validators checked every artifact before output. Notebook originals must have at least one applied saved copy. Private paths and manifest filenames are omitted, not anonymization.</p><nav aria-label="Original bundle chapters">${manifest.bundles.map((item, i) => `<a href="#bundle-${i + 1}">Bundle ${i + 1}: ${escape(item.kind)}</a>`).join('')}</nav><h3>Exact source reuse across ordered roles</h3><ul>${reuse}</ul><h3>Repeated complete artifacts</h3><ul>${repeated}</ul><p>Every occurrence remains separate. Never sum samples, copy counts, spans, distances, grades or completions across bundles/copies. Same CSV can carry different private reviews; different CSVs do not prove different flights. No automatic pairing, annotation transfer, cross-original merge or conversion-lineage check occurs.</p></section>${chapters.join('')}<footer><p>Preserve the original manifest, every original and excluded work separately. Combined chapters are not a reopenable full workspace or complete handoff. No writes, network, upload or sharing. Save only by explicit redirection, check exit status and inspect print preview and audience.</p></footer></main></body></html>`;
  if (Buffer.byteLength(html) > 16 * 1024 * 1024) throw Error('Private packet exceeds output bound.');
  return html;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/report-private-training.mjs MANIFEST.json --include-private-review [--expect-sha256 HEX]\nValidate complete bounded original training manifest and every listed exact artifact with current nested validators before printing one sensitive static HTML discussion packet. Explicit private-output acknowledgement covers all selected originals. Optional independent complete-manifest pin before parse; required per-artifact pins before nested parsing. Existing v1/v2 kinds/path/count/20MiB limits, strict no-symlink regular originals, nonempty saved notebooks.16MiB all-output bound, no partial packet. Private coordinates/reviewer text/readings appear. No lineage check, source backup, authentication, grades/completion/readiness, writes/network/assets/scripts/sharing. Save only by explicit redirection and check exit success.');
  else {
    const options = {}, seen = new Set(); let valid = args[0] && !args[0].startsWith('-');
    for (let i = 1; i < args.length && valid; i++) { const flag = args[i]; if (seen.has(flag)) { valid = false; break; } seen.add(flag); if (flag === '--include-private-review') options.includePrivateReview = true; else if (flag === '--expect-sha256' && pin(args[i + 1])) options.expectedSha256 = args[++i]; else valid = false; }
    if (!valid || !options.includePrivateReview) { console.error('Expected original manifest, explicit private-output acknowledgement and supported options. Use --help.'); process.exitCode = 1; }
    else reportPrivateTraining(args[0], options).then(html => console.log(html)).catch(() => { console.error('Private training packet refused. No HTML issued. Check bounded regular originals, strict in-folder paths, manifest/artifact expectations, current nested models, nonempty notebooks and output bound. Private paths/content not echoed. No writes/upload/sharing. Redirection may leave an empty file; check exit status.'); process.exitCode = 1; });
  }
}
