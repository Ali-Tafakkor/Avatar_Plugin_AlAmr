import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../../Avatar_V2_WebBase/AvatarRuntime/scripts/prepare-assets.mjs', import.meta.url));
const target = fileURLToPath(new URL('../public/avatar-v2/', import.meta.url));
const result = spawnSync(process.execPath, [script, `--destination=${target}`], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
