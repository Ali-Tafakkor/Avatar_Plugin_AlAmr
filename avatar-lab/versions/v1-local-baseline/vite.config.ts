import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  server: { fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../آواتار/dist', import.meta.url))] } },
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'] },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 2400 },
});
