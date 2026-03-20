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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
