import { describe, expect, it } from 'vitest';
import { compactChunks } from '../scripts/compact-chunks.mjs';

const chunk = { fileName: 'assets/example.js' };
const prepare = (minify = 'oxc', sourcemap = false) => {
  const plugin = compactChunks();
  plugin.configResolved({ build: { minify, sourcemap } });
  return plugin;
};
const load = code => import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

describe('production chunk compression', () => {
  it('only applies to production builds using the Oxc final minifier', async () => {
    expect(compactChunks().apply).toBe('build');
    for (const option of [false, 'esbuild', 'terser']) {
      expect(await prepare(option).renderChunk('export const value = 1;', chunk)).toBeNull();
    }
    expect((await prepare(true).renderChunk('export const value = 1;', chunk)).code).toContain('export');
  });
  it('removes dead expressions without changing exported names, imports or observable property reads', async () => {
    const code = `export function run(input) {
      if (false) throw new Error('UNREACHABLE_SENTINEL');
      let reads = 0;
      const record = { get private_name() { reads++; return input; } };
      const value = record.private_name;
      return { value, reads, type: typeof value, private_name: input };
    }`;
    const result = await prepare().renderChunk(code, chunk);
    expect(result.map).toBeNull();
    expect(result.code.length).toBeLessThan(code.length);
    expect(result.code).not.toContain('UNREACHABLE_SENTINEL');
    expect(result.code).toContain('private_name');
    const original = await load(code), compressed = await load(result.code);
    for (const input of [undefined, null, false, 0, -0, NaN, Infinity, '', 'recorded', { key: 1 }]) {
      expect(compressed.run(input)).toEqual(original.run(input));
    }
    const imported = await prepare().renderChunk("import { read } from './other.js'; export const public_name = () => read();", chunk);
    expect(imported.code).toContain('./other.js');
    expect(imported.code).toContain('public_name');
  });
  it('keeps console calls and thrown errors rather than hiding diagnostics', async () => {
    const result = await prepare().renderChunk("export function report(value) { console.warn(value); if (!value) throw new Error('missing value'); }", chunk);
    expect(result.code).toContain('console.warn');
    expect(result.code).toContain('missing value');
    await expect((await load(result.code)).report).toBeTypeOf('function');
  });
  it('returns a composable source map when enabled, including hidden and inline modes', async () => {
    for (const sourcemap of [true, 'hidden', 'inline']) {
      const result = await prepare('oxc', sourcemap).renderChunk('export const value = 1 + 2;', chunk);
      expect(result.map.version).toBe(3);
      expect(result.map.sources).toEqual([chunk.fileName]);
      expect(result.map.mappings.length).toBeGreaterThan(0);
    }
  });
  it('fails the build on invalid JavaScript instead of emitting a partial chunk', async () => {
    await expect(prepare().renderChunk('export const = ;', chunk)).rejects.toThrow();
  });
});
