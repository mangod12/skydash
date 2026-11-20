#!/usr/bin/env node
// Read only. Validation is built from this checkout, never executable input content.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadNotebookValidator } from './verify-paired-review.mjs';
export async function verifyNotebookFile(filename, { expectedSha256 = null } = {}) {
  if (expectedSha256 !== null && !/^[a-fA-F0-9]{64}$/.test(expectedSha256)) throw new Error('Invalid expected artifact digest.');
  const input = resolve(filename), info = await stat(input);
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Notebook artifact must be a regular file up to2MiB.');
  const bytes = await readFile(input); if (bytes.length > 2 * 1024 * 1024) throw new Error('Notebook exceeds2MiB.');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha256 !== null && digest !== expectedSha256.toLowerCase()) throw new Error('Notebook artifact digest mismatch.');
  const validator = await loadNotebookValidator();
  const { data, log } = await validator.readNotebookSourceBundle(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  const copies = data.notebook.windows.map((window, index) => {
    const rows = log.samples.slice(window.first_row - 1, window.last_row);
    const channels = Object.fromEntries(['altitude_m', 'ground_speed_m_s', 'battery_pct'].map(key => [key, { known: rows.filter(row => row[key] !== null).length, missing: rows.filter(row => row[key] === null).length }]));
    return { ordinal: index + 1, first_row: window.first_row, last_row: window.last_row, samples: rows.length, start_s: rows[0].time_s, end_s: rows.at(-1).time_s, intervals_over_5s: rows.slice(1).filter((row, i) => row.time_s - rows[i].time_s > 5).length, channels };
  });
  return { format: 'skydash-notebook-validation-receipt-v1', exact_bundle_sha256: digest, expected_bundle_digest_matched: expectedSha256 !== null, bundle_format: data.format, source: { sha256: log.sha256, samples: log.samples.length, start_s: 0, end_s: log.samples.at(-1).time_s }, saved_copy_count: copies.length, copies,
    scope: 'Exact whole-artifact bytes and nested source/model/inclusive-row bounds validated using this checkout. Per-copy evidence recomputed from embedded CSV, in saved order; overlapping/repeated copies are independent views of the same source, never independent flights. No combined copy samples/duration, grade, completion or readiness totals. Every interval is unsampled, including intervals up to5s; singleton copies have zero intervals. Known cells are not sensor correctness. First-to-last spans are not continuous observation durations. No filenames, saved IDs, labels, private notes, coordinates or individual channel readings printed. Digests/row bounds/counts/times can identify sensitive work. Editable receipt, not source truth, authenticated authorship, signatures, custody or flight/student identity. No report file, writes, uploads, storage, sharing or aircraft commands.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/verify-notebook-review.mjs BUNDLE.json [--expect-sha256 HEX]\nRead-only exact-source notebook validation,2MiB regular UTF-8 JSON, nested hashes/models/copy bounds. Private-text-free per-copy receipt, no writes or combined totals. Expected complete-artifact digest must come separately. No authenticity, flight identity, completion or readiness claim.');
  else if (![1, 3].includes(args.length) || args[0].startsWith('-') || (args.length === 3 && (args[1] !== '--expect-sha256' || !/^[a-fA-F0-9]{64}$/.test(args[2])))) { console.error('Expected notebook JSON path and optional exact expected digest. Use --help.'); process.exitCode = 1; }
  else verifyNotebookFile(args[0], { expectedSha256: args[2] ?? null }).then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Notebook validation failed. No receipt or files written. Check regular UTF-8 JSON,2MiB bounds, expected artifact digest and nested CSV/model/saved-copy bounds. Private inputs are not echoed.'); process.exitCode = 1; });
}
