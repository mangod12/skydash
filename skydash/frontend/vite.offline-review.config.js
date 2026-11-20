import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { compactChunks } from './scripts/compact-chunks.mjs';
const local = name => fileURLToPath(new URL(`./src/offline/${name}`, import.meta.url));
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), compactChunks()],
  resolve: { alias: [
    { find: /^(?:.*\/)?runtimeConfig(?:\.js)?$/, replacement: local('runtimeConfig.js') },
    { find: /^(?:.*\/)?authStore(?:\.js)?$/, replacement: local('authStore.js') },
    { find: /^(?:.*\/)?RecordedBasemap(?:\.jsx)?$/, replacement: local('RecordedBasemap.jsx') },
  ] },
  build: { outDir: 'dist-offline-review', emptyOutDir: true, chunkSizeWarningLimit: 1000, rollupOptions: { input: fileURLToPath(new URL('./offline-review.html', import.meta.url)) } },
});
