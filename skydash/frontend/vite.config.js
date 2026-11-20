import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compactChunks } from './scripts/compact-chunks.mjs'

export default defineConfig({
  plugins: [react(), compactChunks()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
