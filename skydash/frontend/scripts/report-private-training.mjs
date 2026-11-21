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
import { renderPrivateTraining } from '../src/utils/privateTrainingHtml.js';
export async function reportPrivateTraining(filename, { includePrivateReview = false, expectedSha256 = null } = {}) {
  if (includePrivateReview !== true || (expectedSha256 !== null && !pin(expectedSha256))) throw Error('Explicit private acknowledgement and supported expectation required.');
  const path = resolve(filename), raw = await readBoundedPrivateOriginal(path, 65536), digest = hash(raw);
  if (expectedSha256 !== null && digest !== expectedSha256.toLowerCase()) throw Error('Independent manifest expectation mismatch.');
  // Pin the checked raw manifest, preventing a second manifest read from changing selection.
  const checked = await verifyTrainingManifest(path, { expectedSha256: digest });
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw));
  const root = dirname(path), reports = [];
  for (const [index, item] of manifest.bundles.entries()) {
    const target = resolve(root, item.path), canonical = await realpath(target), child = relative(root, canonical);
    if (canonical !== target || !child || isAbsolute(child) || child === '..' || child.startsWith('..' + sep)) throw Error('Strict in-folder regular originals required.');
    // Each individual report pins the original bytes again before parsing all nested models.
    const report = await reportPrivateDebrief(item.kind, target, { includePrivateReview: true, expectedSha256: item.sha256 });
    reports.push(report);
  }
  return renderPrivateTraining(manifest, checked, reports, { digest, expectedSha256 });
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
