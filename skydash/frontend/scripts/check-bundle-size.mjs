// Fails when the gzipped JS in dist/assets grows past a budget, so size creep shows up in CI.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB || 755);
const dir = join(process.cwd(), 'dist', 'assets');
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const sizes = files
  .map((f) => ({ f, kb: gzipSync(readFileSync(join(dir, f))).length / 1024 }))
  .sort((a, b) => b.kb - a.kb);
const total = sizes.reduce((s, x) => s + x.kb, 0);

for (const { f, kb } of sizes.slice(0, 5)) console.log(`${kb.toFixed(1).padStart(7)} kB gz  ${f}`);
console.log(`Total JS: ${total.toFixed(1)} kB gzip (budget ${BUDGET_KB} kB)`);
if (total > BUDGET_KB) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}
