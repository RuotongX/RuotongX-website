import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: { port: 5320, strictPort: true },
  preview: { port: 5321, strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: 'es' },
});
