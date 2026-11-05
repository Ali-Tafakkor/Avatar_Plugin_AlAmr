import { defineConfig } from 'vite';
export default defineConfig({ base: './', publicDir: '.prepared',
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'] },
  esbuild: { jsx: 'automatic' },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 2400 },
  server: { host: '127.0.0.1', port: 5392, strictPort: true },
  preview: { host: '127.0.0.1', port: 5392, strictPort: true }
});
