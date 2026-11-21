#!/usr/bin/env node
// Fixed synthetic source only. No user input files, original telemetry or folder scans.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { writeTrainingArchive } from './package-training-intake.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const save = (folder, name, bytes) => writeFile(join(folder, name), bytes, { flag: 'wx', mode: 0o600 });
async function models() {
  const result = await build({ configFile: false, root, logLevel: 'silent', build: { ssr: resolve(root, 'scripts/training-example-models.mjs'), write: false, minify: false, sourcemap: false } });
  const chunks = result.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw Error('Expected one self-contained example module.');
  return import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64'));
}
export async function createTrainingExample(outputPath) {
  const { files, training, lineageFiles, lineage } = await (await models()).syntheticTrainingOriginals();
  const folder = resolve(outputPath); await mkdir(folder, { mode: 0o700 });
  for (const [name, bytes] of Object.entries(files)) await save(folder, name, bytes);
  await save(folder, 'training.json', training); await mkdir(join(folder, 'lineage'), { mode: 0o700 });
  for (const [name, bytes] of Object.entries(lineageFiles)) await save(join(folder, 'lineage'), name, bytes);
  await save(join(folder, 'lineage'), 'lineage.json', lineage);
  const receipt = await writeTrainingArchive(join(folder, 'training.json'), join(folder, 'synthetic-handoff.zip'), { lineageManifest: join(folder, 'lineage', 'lineage.json'), confirmedWGS84: true });
  await save(folder, 'archive-receipt.json', JSON.stringify(receipt, null, 2));
  const guide = ['SKYDASH / SYNTHETIC TRAINING STARTER', '', 'All sources, coordinates, converted data and reviews are fixed fabricated examples. Not real aircraft, people, flights or completed training. No OEM compatibility, authenticity, custody, certification or readiness evidence.', '', 'No user input files, folders or accounts were read. Existing files/directories are never overwritten. No upload, email, storage elsewhere, sharing or aircraft commands.', '', 'From skydash/frontend in this checkout, replace KIT with this new folder using shell-safe quoting:', 'node scripts/verify-training-manifest.mjs KIT/training.json', 'node scripts/verify-training-lineage.mjs KIT/training.json KIT/lineage/lineage.json --confirm-wgs84', 'node scripts/report-training-intake.mjs KIT/training.json --lineage-manifest KIT/lineage/lineage.json --confirm-wgs84 > NEW.html', '', 'The coordinate confirmation above is your fresh statement about these known synthetic fixtures. The generator confirms only its own fixed fabricated WGS84 coordinates, never any user/OEM file.', 'There are three mixed artifacts. Case/notebook/paired-primary reuse the same native synthetic CSV. Only paired-baseline is reproduced by the explicit mapping relation. Unlinked native source roles remain explicit; require-all should fail, not fabricate missing lineage or infer incorrect units.', '', 'sample.csv is a convenience original beside the source-embedded artifacts. synthetic-handoff.zip contains only training.json, its three listed originals, the explicit lineage manifest/files and fresh report/receipt/guide, not this whole directory. The separate EXAMPLE-GUIDE and archive receipt are not automatically included. Extract with a trusted tool into a new private folder and revalidate original manifests there.', '', 'Opening case/notebook/paired files in the replay UI follows its existing replacement confirmation and exclusion boundaries. Keep other unsaved work separately first. Nothing is opened automatically. The files have no expiry, student IDs or real timestamps.', 'Computed hashes demonstrate byte agreement, not an independent authentication route. The ZIP format is unencrypted and whole-original. Never replace these with real private files and assume the result is redacted or safe to share. This example is not a complete workspace backup or handoff certificate.'].join('\n');
  await save(folder, 'EXAMPLE-GUIDE.txt', guide);
  return { format: 'skydash-synthetic-training-starter-v1', synthetic_only: true, bundle_count: 3, archive: receipt, scope: 'Explicit new folder of fixed fabricated case/notebook/paired/mapping examples. No real source inputs, scans, credentials, existing-file edits, upload, sharing or aircraft commands. All hashes generated locally, not independent authenticity. Partial new output may remain on failure; no success receipt is issued unless all steps finish. Native shared sources deliberately remain unlinked; no flight/student/completion/readiness evidence.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/create-training-example.mjs --output-dir NEW_FOLDER\nCreates fixed fabricated original source/case/notebook/paired/mapping fixtures, explicit manifests and a checked unencrypted ZIP with fresh report/receipt/guide. No user input files or account reads. New folder only, no overwrite. Complete synthetic-only scope in EXAMPLE-GUIDE.txt. Partial new folder may remain on failure, with no success receipt. No real flight, OEM compatibility, completion, authentication or readiness claim.');
  else if (args.length !== 2 || args[0] !== '--output-dir' || !args[1] || args[1].startsWith('-')) { console.error('Expected one explicit new output directory. Use --help.'); process.exitCode = 1; }
  else createTrainingExample(args[1]).then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(() => { console.error('Synthetic example not completed. No success receipt. Use installed checkout dependencies and one new writable directory, never an existing file, folder or symlink. Existing items not overwritten. A partially created new example folder may remain on failure. No user input files or accounts were read.'); process.exitCode = 1; });
}
