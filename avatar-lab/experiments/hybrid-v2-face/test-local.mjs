import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Only the active native-topology face and body. The abandoned direct V1 face
// experiment has separate historical tests and is not a runtime dependency.
const result = spawnSync(process.execPath, ['--test',
  'experiments/hybrid-v2-face/tests/body-runtime.test.mjs',
  'experiments/hybrid-v2-face/tests/native-head.test.mjs',
  'experiments/hybrid-v2-face/tests/runtime.test.mjs',
  'experiments/hybrid-v2-face/sculpted-face.test.mjs',
], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
process.exitCode = result.status ?? 1;
