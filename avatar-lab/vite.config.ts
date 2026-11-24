import { defineConfig } from 'vite';
const localPath = (relative: string) => decodeURIComponent(new URL(relative, import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:\/)/, '');
export default defineConfig({
  base: './',
  server: { fs: { allow: [localPath('.'), localPath('../آواتار/dist'), localPath('../Avatar_V2_WebBase/AvatarRuntime'), localPath('../avatar-olive-man'), localPath('../avatar-blue-man'), localPath('../avatar-elder-man')] } },
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'] },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 2400 },
});
