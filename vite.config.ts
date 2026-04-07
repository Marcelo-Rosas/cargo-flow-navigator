import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

import { cloudflare } from '@cloudflare/vite-plugin';

// https://vitejs.dev/config/
// Config estático para compatibilidade com Cloudflare Pages/Wrangler (não usar arrow function).
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  server: {
    host: '::',
    port: Number(process.env.PORT) || 8080,
  },
  plugins: [react(), ...(isDev ? [componentTagger()] : []), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // kB — default é 500
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor-react';
            if (id.includes('react-router')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@radix-ui')) return 'vendor-ui';
            if (id.includes('leaflet')) return 'vendor-map';
            if (id.includes('@dnd-kit')) return 'vendor-dnd';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('date-fns')) return 'vendor-date';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          }
        },
      },
    },
  },
});
