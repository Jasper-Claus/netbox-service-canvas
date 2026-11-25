/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The bundle is written into the Python package so that no Node.js is needed at install time.
// Output names are fixed (no hashes) because the Django template references them directly.
const outDir = resolve(__dirname, '../netbox_service_canvas/static/netbox_service_canvas/dist');

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Relative base: lazily loaded chunks (e.g. elkjs) are resolved relative to canvas.js,
  // which works under any STATIC_URL / BASE_PATH.
  base: './',
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
  },
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    target: 'es2020',
    modulePreload: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.tsx'),
      output: {
        format: 'es',
        entryFileNames: 'canvas.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (info) =>
          (info.names?.[0] ?? info.name ?? '').endsWith('.css') ? 'canvas.css' : 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
