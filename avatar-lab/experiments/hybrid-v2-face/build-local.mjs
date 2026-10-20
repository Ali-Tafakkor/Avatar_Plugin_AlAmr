import { spawnSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const host = fileURLToPath(new URL('../../', import.meta.url));
const inspection = process.argv.includes('--inspection');
const output = inspection ? 'dist-hybrid-review' : 'dist-hybrid-test';
for (const args of [
  ['experiments/hybrid-v2-face/prepare-assets.mjs'],
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.hybrid-test.config.ts', '--mode', inspection ? 'inspection' : 'production', '--outDir', output],
]) {
  const result = spawnSync(process.execPath, args, { cwd: host, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
await copyFile(new URL('../../' + output + '/hybrid-test.html', import.meta.url), new URL('../../' + output + '/index.html', import.meta.url));
console.log('LOCAL_HYBRID_TEST_BUILT: ' + output + '/index.html (accepted and Phase 1 dist unchanged)');
