import { minify } from 'terser';

// Compress bundled expressions before Oxc performs final minification. Keep Oxc's
// identifier mangling, browser target and chunk layout. Never enable unsafe
// transforms, property mangling, console removal or assumptions about getters.
export function compactChunks() {
  let enabled = false;
  let sourceMap = false;
  return {
    name: 'compact-chunks',
    apply: 'build',
    configResolved(config) {
      enabled = config.build.minify === 'oxc' || config.build.minify === true;
      sourceMap = Boolean(config.build.sourcemap);
    },
    async renderChunk(code, chunk) {
      if (!enabled) return null;
      const result = await minify({ [chunk.fileName]: code }, {
        module: true,
        mangle: false,
        compress: { passes: 3 },
        sourceMap: sourceMap ? { asObject: true } : false,
      });
      if (typeof result.code !== 'string') throw new Error('Chunk compression returned no code');
      return { code: result.code, map: result.map ?? null };
    },
  };
}
