import { spawnSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const host = fileURLToPath(new URL('../../', import.meta.url));
for (const args of [
  ['experiments/v1-motion/prepare-assets.mjs'],
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.motion-test.config.ts'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: host, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
await copyFile(new URL('../../dist-motion-test/motion-test.html', import.meta.url), new URL('../../dist-motion-test/index.html', import.meta.url));
console.log('LOCAL_MOTION_TEST_BUILT: dist-motion-test/index.html (accepted dist unchanged)');
