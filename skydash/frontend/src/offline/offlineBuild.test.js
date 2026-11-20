import { expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
it('builds an isolated relative-asset review without inherited endpoint/account policy or remote fonts, tiles or deployment config', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skydash-offline-build-')), out = join(dir, 'site');
  try {
    const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.offline-review.config.js', '--outDir', out], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 45000, env: { ...process.env, NODE_ENV: 'production', VITE_API_URL: 'https://offline-test.invalid/PRIVATE', VITE_WS_URL: 'wss://offline-test.invalid/PRIVATE', VITE_ADSB_URL: 'https://offline-test.invalid/PRIVATE' } });
    expect(result.status, result.stderr).toBe(0); expect((await readdir(out)).sort()).toEqual(['assets', 'offline-review.html']);
    const html = await readFile(join(out, 'offline-review.html'), 'utf8'); for (const policy of ["default-src 'none'", "connect-src 'none'", "worker-src 'none'", "script-src 'self'", "font-src 'self'", "base-uri 'none'", "form-action 'none'", 'Standalone Recorded Review']) expect(html).toContain(policy); expect(html).toContain('./assets/'); expect(html).not.toContain('/src/');
    const names = await readdir(join(out, 'assets')), scripts = names.filter(n => n.endsWith('.js')), styles = names.filter(n => n.endsWith('.css')); expect(scripts.length).toBeGreaterThan(0); expect(styles.length).toBeGreaterThan(0);
    const text = (await Promise.all(names.map(name => readFile(join(out, 'assets', name), 'utf8')))).join('\n');
    for (const absent of ['offline-test.invalid', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tile.openstreetmap.org', 'skydash_token', 'skydash_user', 'navigator.serviceWorker', 'staticwebapp.config']) expect(text.includes(absent), absent).toBe(false);
    for (const present of ['Background tiles unavailable in standalone recorded review', 'Start a new local review', 'new empty local review', 'Check received package', 'Flight Log Replay']) expect(text.includes(present), present).toBe(true);
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 50000);
