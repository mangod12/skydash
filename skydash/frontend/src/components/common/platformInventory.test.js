// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { INVENTORY } from './platformInventory.js';

const root = resolve(__dirname, '..', '..');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const backend = resolve(root, '..', '..', '..', 'backend');
const inv = Object.fromEntries(INVENTORY);
// The page shows "N+": N must not overstate and must not be stale.
const fresh = (label, actual) => {
  expect(inv[label], label).toBeLessThanOrEqual(actual);
  expect(inv[label], label).toBeGreaterThanOrEqual(Math.floor(actual / 1.25));
};

describe('platform inventory', () => {
  it('matches the component count', () => {
    const n = walk(join(root, 'components')).filter((f) => f.endsWith('.jsx') && !f.endsWith('.test.jsx')).length;
    fresh('Components', n);
  });

  it('matches the store, hook and view counts', () => {
    fresh('Stores', readdirSync(join(root, 'stores')).filter((f) => /Store\.js$/.test(f)).length);
    fresh('Hooks', readdirSync(join(root, 'hooks')).filter((f) => /^use.*\.jsx?$/.test(f) && !f.includes('.test.')).length);
    expect(inv.Views).toBe(readdirSync(join(root, 'components', 'views')).filter((f) => /View\.jsx$/.test(f)).length);
  });

  it.skipIf(!existsSync(backend))('matches the backend endpoint count', () => {
    const files = walk(backend).filter((f) => f.endsWith('.py') && !/[\\/](tests|scripts)[\\/]/.test(f));
    const re = /^@(router|app)\.(get|post|put|delete|patch|websocket|api_route)\(/gm;
    const n = files.reduce((sum, f) => sum + (readFileSync(f, 'utf8').match(re) || []).length, 0);
    fresh('API Endpoints', n);
  });

  it('matches the theme count', () => {
    const src = readFileSync(join(root, 'hooks', 'consoleHandlers.js'), 'utf8');
    const m = src.match(/const valid = \[([^\]]*)\]/);
    expect(inv.Themes).toBe(m[1].split(',').filter((x) => x.trim()).length);
  });

  it('does not carry hand-written line or phase counts', () => {
    const src = readFileSync(join(root, 'components', 'common', 'PlatformStatus.jsx'), 'utf8');
    expect(src).not.toMatch(/13,518|Dev Phases|Source Files/);
  });
});

describe('formatCount', () => {
  it('shows lower bounds with a plus and stable counts exactly', async () => {
    const { formatCount } = await import('./platformInventory.js');
    expect(formatCount('Components', 220)).toBe('220+');
    expect(formatCount('Views', 8)).toBe('8');
    expect(formatCount('Themes', 3)).toBe('3');
  });
});
