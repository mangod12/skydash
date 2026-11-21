#!/usr/bin/env node
// Explicit sensitive human-readable output, never treat private review text as markup or code.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
import { renderPrivateDebrief } from '../src/utils/privateDebriefHtml.js';
export async function readBoundedPrivateOriginal(filename, limit) {
  const path = resolve(filename), canonical = await realpath(path), before = await lstat(path);
  if (canonical !== path || !before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > limit) throw Error('Invalid bounded original.');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat(); if (!info.isFile() || info.size < 1 || info.size > limit) throw Error('Invalid original size.');
    const bytes = Buffer.alloc(info.size + 1); let length = 0;
    while (length < bytes.length) { const read = await file.read(bytes, length, bytes.length - length, null); if (!read.bytesRead) break; length += read.bytesRead; }
    if (length !== info.size || await realpath(path) !== path) throw Error('Changed original.');
    return bytes.subarray(0, length);
  } finally { await file.close(); }
}
export async function reportPrivateDebrief(kind, filename, { includePrivateReview = false, expectedSha256 = null } = {}) {
  if (!includePrivateReview || !['case', 'paired', 'notebook'].includes(kind) || (expectedSha256 !== null && !/^[a-fA-F0-9]{64}$/.test(expectedSha256))) throw Error('Explicit kind and private-output acknowledgement required.');
  const bytes = await readBoundedPrivateOriginal(filename, (kind === 'paired' ? 4 : 2) * 1024 * 1024), digest = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha256 !== null && digest !== expectedSha256.toLowerCase()) throw Error('Independent original expectation mismatch.');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const output = await build({ configFile: false, root, logLevel: 'silent', build: { ssr: resolve(root, 'src/utils/privateDebriefReport.js'), write: false, minify: false, sourcemap: false } });
  const chunks = output.output.filter(item => item.type === 'chunk'); if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw Error('Expected isolated report module.');
  const validator = await import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64')), data = await validator.readPrivateDebrief(kind, text);
  return renderPrivateDebrief(kind, data, { digest, expectedSha256 });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/report-private-debrief.mjs case|paired|notebook ORIGINAL.json --include-private-review [--expect-sha256 HEX]\nValidate complete bounded original and current nested app models, recompute existing recorded analyst/source/instructor/envelope/comparison reports, then print sensitive static HTML to stdout. Explicit private-output acknowledgement required. Private notes, filenames, marker coordinates and criteria can appear. Optional independent raw-artifact pin before parse. No writes/network/assets/scripts/sharing. Shell redirection is your separate save action; check exit success before using output. Editable unsigned report, not certified training/authorship/readiness or a reopenable source backup.');
  else {
    const options = {}, seen = new Set(); let valid = ['case', 'paired', 'notebook'].includes(args[0]) && args[1] && !args[1].startsWith('-');
    for (let i = 2; i < args.length && valid; i++) { const flag = args[i]; if (seen.has(flag)) { valid = false; break; } seen.add(flag); if (flag === '--include-private-review') options.includePrivateReview = true; else if (flag === '--expect-sha256' && /^[a-fA-F0-9]{64}$/.test(args[i + 1] || '')) options.expectedSha256 = args[++i]; else valid = false; }
    if (!valid || !options.includePrivateReview) { console.error('Expected explicit original kind/path and private-output acknowledgement with supported options. Use --help.'); process.exitCode = 1; }
    else reportPrivateDebrief(args[0], args[1], options).then(html => console.log(html)).catch(() => { console.error('Private debrief refused. No HTML issued. Check original kind, bounded regular UTF-8 file, independently expected digest and current nested source/model/review bounds. Private paths/content not echoed. Nothing written, uploaded or shared. A shell-redirection output may be empty; check command success.'); process.exitCode = 1; });
  }
}
