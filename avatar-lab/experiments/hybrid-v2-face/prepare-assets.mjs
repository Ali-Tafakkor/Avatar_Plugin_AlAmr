import { access, readFile } from 'node:fs/promises';

// Stage 2 reads the already extracted, unchanged V1/V2 local references.
// This preflight never rewrites Phase 1 public assets or accepted bundles.
const publicRoot = new URL('../../public/', import.meta.url);
let checked = 0;
for (const relative of ['motion-test/reference/legacy.gltf', 'avatar-v2/avatar.gltf']) {
  const url = new URL(relative, publicRoot);
  const gltf = JSON.parse(await readFile(url, 'utf8')); checked++;
  for (const resource of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
    if (!resource.uri || resource.uri.startsWith('data:')) continue;
    if (/^[a-z]+:/i.test(resource.uri)) throw new Error('hybrid_remote_asset_not_allowed:' + resource.uri);
    await access(new URL(resource.uri, url)); checked++;
  }
}
await access(new URL('avatar-v2/motions.json', publicRoot)); checked++;
console.log(JSON.stringify({ code: 'HYBRID_LOCAL_ASSETS_VERIFIED', checked, assetsChanged: false }));
