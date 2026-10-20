import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
const entry = decodeURIComponent(new URL('./motion-test.html', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:\/)/, '');
export default mergeConfig(base, defineConfig({
  build: { outDir: 'dist-motion-test', rollupOptions: { input: entry } },
}));
