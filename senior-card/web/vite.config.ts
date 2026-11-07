import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Same-origin with the API through nginx (`/api`), so no proxy is needed
// in production. The devServer proxy below is for local development only.
export default defineConfig({
  plugins: [vue()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
