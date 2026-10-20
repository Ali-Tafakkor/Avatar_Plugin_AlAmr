import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

// Production carries only generated Plugin resources and presentation artwork.
// The original public directory remains available to the separate local labs.
export default mergeConfig(base, defineConfig({ publicDir: '.public-production' }));
