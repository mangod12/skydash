#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { verifyTrainingManifest } from './verify-training-manifest.mjs';
import { readBoundedPrivateOriginal } from './report-private-debrief.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const file = (name, bytes) => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes });
export async function reportTrainingAgenda(filename, { includePrivateReview = false, expectedSha256 = null } = {}) {
  if (includePrivateReview !== true || (expectedSha256 !== null && !pin(expectedSha256))) throw Error('Explicit private acknowledgement and valid expectation required.');
  const path = resolve(filename), raw = await readBoundedPrivateOriginal(path, 65536), digest = hash(raw);
  if (expectedSha256 !== null && digest !== expectedSha256.toLowerCase()) throw Error('Independent manifest expectation mismatch.');
  await verifyTrainingManifest(path, { expectedSha256: digest });
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw)), folder = dirname(path), files = [];
  // CLI accepts the strict flat browser handoff layout, not arbitrary folder traversal.
  for (const item of manifest.bundles) {
    const target = resolve(folder, item.path), child = relative(folder, target);
    if (!child || isAbsolute(child) || child === '..' || child.startsWith('..' + sep) || child.includes(sep)) throw Error('Flat in-folder originals required.');
    const bytes = await readBoundedPrivateOriginal(target, (item.kind === 'paired' ? 4 : 2) * 1024 * 1024);
    if (hash(bytes) !== item.sha256.toLowerCase()) throw Error('Changed original bytes.');
    files.push(file(item.path, bytes));
  }
  const output = await build({ configFile: false, root, logLevel: 'silent', build: { ssr: resolve(root, 'src/utils/browserTrainingAgenda.js'), write: false, minify: false, sourcemap: false } });
  const chunks = output.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw Error('Expected isolated agenda module.');
  const helper = await import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64'));
  return (await helper.browserTrainingAgenda(file(relative(folder, path), raw), files, { includePrivateReview: true, expectedSha256: expectedSha256 || '' })).html;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), options = {}, seen = new Set();
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/report-training-agenda.mjs MANIFEST.json --include-private-review [--expect-sha256 HEX]\nFreshly validate every original in a bounded flat browser handoff manifest and print sensitive HTML containing only undiscussed Question/Follow-up primary instructor markers. Notebook originals are validated but explicitly not applicable. Optional independent complete-manifest pin, required per-artifact pins. Strict regular no-symlink files. No imported reports, writes, scripts, network, storage, assignments, sharing or completion/readiness claims. Output is not a complete discussion or backup. Save only by explicit redirection and verify exit success.');
  else {
    let valid = Boolean(args[0] && !args[0].startsWith('-'));
    for (let i = 1; i < args.length && valid; i++) { const flag = args[i]; if (seen.has(flag)) { valid = false; break; } seen.add(flag); if (flag === '--include-private-review') options.includePrivateReview = true; else if (flag === '--expect-sha256' && pin(args[i + 1])) options.expectedSha256 = args[++i]; else valid = false; }
    if (!valid || !options.includePrivateReview) { console.error('Expected original manifest, explicit private acknowledgement and supported options. Use --help.'); process.exitCode = 1; }
    else reportTrainingAgenda(args[0], options).then(html => console.log(html)).catch(() => { console.error('Private agenda refused. No HTML issued. Check strict flat bounded originals, expectations and nested validation. Private inputs not echoed. No writes or sharing. Redirection may leave an empty file; check exit success.'); process.exitCode = 1; });
  }
}
