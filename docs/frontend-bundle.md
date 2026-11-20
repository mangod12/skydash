# Frontend bundle compression

The production build uses a conservative Terser expression-compression pass on
bundled ES modules before Vite/Oxc performs final minification and identifier
mangling. The development server and tests do not run this pass. Explicitly
disabling minification, or selecting a different final minifier, skips the pass.

The pass keeps the existing chunks and browser target. It does not enable unsafe
transforms, property mangling, console removal or assumptions about getters. It
returns source maps when Vite requests them, including hidden and inline maps.
Compression errors fail the build rather than publishing a partial result.

Measured with the same application, chunk rules and unchanged 750 KiB gzip budget:

- Oxc alone: 749.5 KiB total JavaScript gzip.
- Terser compression plus Oxc: 740.6 KiB, about 8.9 KiB less.
- Local production build: about 16 seconds rather than 2 seconds. CI timing varies.

Measure using `npm run build` then `node scripts/check-bundle-size.mjs` from
`skydash/frontend`. The budget counts every JavaScript chunk, including lazy
chunks, rather than just the first-page transfer. It is not a claim about
network latency, frame rate or flight-system performance.

The compressor is a pinned development dependency. Its regression tests cover
observable property reads, exported names, imports, diagnostic calls, source
maps, invalid-input failures and minifier opt-outs. Changes to production
compression also need browser tests against the actual built assets. Development
server tests alone do not exercise the compressed output.
