import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
  },
  server: {
    port: 3000,
    open: true,
  },
});
