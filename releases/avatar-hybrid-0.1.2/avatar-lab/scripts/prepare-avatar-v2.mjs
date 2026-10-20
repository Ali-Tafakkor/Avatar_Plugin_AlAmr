import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../../آواتار/dist/assets/avatar-v2/', import.meta.url);
const target = new URL('../public/avatar-v2/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('asset-manifest.json',source),'utf8'));
await cp(source,target,{recursive:true});
await rm(new URL('avatar.glb',target),{force:true});
console.log(JSON.stringify({code:'AVATAR_V2_HOST_USES_PLUGIN_ASSETS',joints:manifest.jointCount,morphs:manifest.morphNames.length,target:fileURLToPath(target)}));
