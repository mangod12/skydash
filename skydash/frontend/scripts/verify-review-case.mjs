#!/usr/bin/env node
// Read-only validation. Input files never supply code or trusted result claims.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCaseValidator } from './verify-paired-review.mjs';
export async function verifyReviewCase(filename, { expectedSha256 = null } = {}) {
  if (expectedSha256 !== null && !/^[a-fA-F0-9]{64}$/.test(expectedSha256)) throw new Error('Invalid expected case digest.');
  const path = resolve(filename), info = await stat(path);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Case must be a regular file up to2MiB.');
  const bytes = await readFile(path); if (bytes.length > 2 * 1024 * 1024) throw new Error('Case exceeds2MiB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha256 !== null && sha256 !== expectedSha256.toLowerCase()) throw new Error('Expected case artifact digest mismatch.');
  const validator = await loadCaseValidator(), { data, log } = await validator.readReviewCase(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  return { format: 'skydash-review-case-validation-receipt-v1', exact_bundle_sha256: sha256, expected_bundle_digest_matched: expectedSha256 !== null, bundle_format: data.format, source: { sha256: log.sha256, samples: log.samples.length, start_s: 0, end_s: log.samples.at(-1).time_s }, included_reviews: { instructor_markers: data.debrief.markers.length, evaluated_envelope: Boolean(data.envelope) },
    scope: 'Exact embedded CSV bytes and actual app case/replay/instructor/envelope model and marker bounds validated. No imported computed results accepted. Full-artifact digest includes private review text and JSON formatting, separately from source CSV hash. Independent expected digest optional; obtain through a trusted separate route. No filenames, titles, private notes, marker text/IDs, criteria values, coordinates or individual readings printed. Hashes/counts/times may identify sensitive work. First-to-last span is not continuous observation duration. Editable receipt, not a signature, authenticated authorship/custody, telemetry truth, flight/student identity, grade, completion or readiness. Case excludes notebook/comparison/mapping originals and other workspace state; receipt does not certify complete handoff. No files written, reports generated, network, storage, upload, sharing or aircraft commands.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/verify-review-case.mjs CASE.json [--expect-sha256 HEX]\nOffline read-only validation of an existing self-contained single-source review case, regular strict UTF-8 up to2MiB. Actual app nested source/model/marker-bound validators; optional independent complete-file digest checked before parsing. No private text, coordinates, writes, authenticity or readiness claims.');
  else if (![1, 3].includes(args.length) || args[0].startsWith('-') || (args.length === 3 && (args[1] !== '--expect-sha256' || !/^[a-fA-F0-9]{64}$/.test(args[2])))) { console.error('Expected a case JSON path and optional complete-file digest. Use --help.'); process.exitCode = 1; }
  else verifyReviewCase(args[0], { expectedSha256: args[2] ?? null }).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Review case validation failed. No receipt or files written. Check the bounded regular UTF-8 file, independently expected artifact digest, exact source hash and supported nested models/review bounds. Private inputs are not echoed.'); process.exitCode = 1; });
}
