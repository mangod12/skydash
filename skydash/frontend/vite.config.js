import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) return 'vendor-map';
            if (id.includes('/recharts/') || id.includes('/date-fns/') || id.includes('/clsx/')) return 'vendor-charts';
            if (id.includes('/framer-motion/')) return 'vendor-motion';
            if (id.includes('/zustand/') || id.includes('/cmdk/') || id.includes('/lucide-react/')) return 'vendor-utils';
          }
        },
      },
    },
  },
})
