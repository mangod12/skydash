import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) return 'vendor-map';
            if (id.includes('/@deck.gl/') || id.includes('/@luma.gl/') || id.includes('/@math.gl/') || id.includes('/@probe.gl/') || id.includes('/@loaders.gl/')) return 'vendor-deckgl';
            if (id.includes('/recharts/') || id.includes('/date-fns/') || id.includes('/clsx/')) return 'vendor-charts';
            if (id.includes('/framer-motion/')) return 'vendor-motion';
            if (id.includes('/zustand/') || id.includes('/cmdk/') || id.includes('/lucide-react/')) return 'vendor-utils';
          }
        },
      },
    },
  },
})
