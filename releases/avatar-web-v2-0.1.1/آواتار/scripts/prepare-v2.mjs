import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseGLB } from './glb.mjs';

const from = path => new URL('../assets-source/web-v2/' + path, import.meta.url);
const into = path => new URL('../dist/assets/avatar-v2/' + path, import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedModel = '193c07c351f1f94b12b499ece3f8813432dbe902afe0b5dd6957e788a9a36605';
const expectedMotions = '533829f6f7b4eca37586564c5d55f3807ae3537878e8007f2af55c853d732d24';
const model = await readFile(from('avatar.glb')), motions = await readFile(from('motions.json'));
if (hash(model) !== expectedModel || hash(motions) !== expectedMotions) throw new Error('avatar_v2_source_integrity_mismatch');
const original = parseGLB(model), document = structuredClone(original.json);
if (document.buffers.length !== 1 || document.buffers[0].uri) throw new Error('avatar_v2_unexpected_buffer_layout');
const outputs = new Map([['avatar.bin',original.binary],['motions.json',motions]]);
for (const [index,image] of document.images.entries()) {
  const view = document.bufferViews[image.bufferView];
  const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.mimeType];
  if (!view || image.uri || !extension) throw new Error('avatar_v2_unexpected_embedded_image');
  const name = `images/image-${String(index).padStart(2,'0')}.${extension}`;
  outputs.set(name,original.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
  delete image.bufferView;image.uri=name;
}
document.buffers[0].uri='avatar.bin';
outputs.set('avatar.gltf',Buffer.from(JSON.stringify(document)));
outputs.set('provenance.json',await readFile(from('provenance.json')));
outputs.set('THIRD_PARTY_NOTICES.md',await readFile(new URL('../THIRD_PARTY_NOTICES.md',import.meta.url)));
const manifest={format:1,sourceModelSha256:expectedModel,sourceMotionSha256:expectedMotions,
  geometryAndSkinUnchanged:true,meshCount:document.meshes.length,jointCount:document.skins[0].joints.length,
  morphNames:[...new Set(document.meshes.flatMap(mesh=>mesh.extras?.targetNames??[]))],
  files:[...outputs].map(([path,bytes])=>({path,bytes:bytes.length,sha256:hash(bytes)}))};
outputs.set('asset-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)));
await mkdir(into('images/'),{recursive:true});
// The source GLB remains in assets-source. The runtime loads the equivalent
// glTF/bin/images; shipping a second complete GLB wastes the 25 MiB budget.
await rm(into('avatar.glb'),{force:true});
for (const [path,bytes] of outputs) await writeFile(into(path),bytes);
await mkdir(new URL('../dist/web-v2/',import.meta.url),{recursive:true});
for(const name of ['actor.mjs','animation.mjs','expressions.mjs','math.mjs','physics.mjs','runtime.mjs','runtime.d.mts'])
  await copyFile(new URL('../src/web-v2/'+name,import.meta.url),new URL('../dist/web-v2/'+name,import.meta.url));
console.log(JSON.stringify({code:'AVATAR_V2_PLUGIN_ASSETS_READY',joints:manifest.jointCount,morphs:manifest.morphNames.length,images:document.images.length,files:outputs.size}));
