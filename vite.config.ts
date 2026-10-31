import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: 'apps/web',
  plugins: [svelte({ configFile: '../../svelte.config.js' }), tailwindcss()],
  base: process.env.BASE_PATH || '/',
  resolve: {
    alias: { '@trackball/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)) },
  },
  worker: { format: 'es' },
  build: { target: 'es2022', outDir: '../../dist', emptyOutDir: true },
});
