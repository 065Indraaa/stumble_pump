// ============================================================
// STUMBLE PUMP — Vite config
// Rapier3D-compat ships a prebuilt WASM blob; keep it out of
// pre-bundling so Vite serves the wasm correctly in dev.
// ============================================================
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5188,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 5188,
  },
  optimizeDeps: {
    // Rapier's WASM glue must not be pre-bundled by esbuild
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
