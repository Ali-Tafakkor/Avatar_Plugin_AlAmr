import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { parseGLB } from './glb.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceHash = '193c07c351f1f94b12b499ece3f8813432dbe902afe0b5dd6957e788a9a36605';
const motionHash = '533829f6f7b4eca37586564c5d55f3807ae3537878e8007f2af55c853d732d24';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const model = await readFile(join(root, 'assets/avatar.glb'));
const motion = await readFile(join(root, 'assets/motions.json'));
if (hash(model) !== sourceHash || hash(motion) !== motionHash) throw new Error('avatar_v2_source_integrity_mismatch');
const parsed = parseGLB(model), document = structuredClone(parsed.json);
if (document.buffers.length !== 1 || document.buffers[0].uri) throw new Error('avatar_v2_unexpected_buffer_layout');
const manifest = { format: 1, sourceModelSha256: sourceHash, sourceMotionSha256: motionHash, geometryAndSkinUnchanged: true,
  meshCount: document.meshes.length, jointCount: document.skins[0].joints.length,
  morphNames: [...new Set(document.meshes.flatMap(mesh => mesh.extras?.targetNames || []))], files: [] };
const outputs = new Map([['avatar.bin', parsed.binary], ['motions.json', motion]]);
for (const [index, image] of document.images.entries()) {
  const view = document.bufferViews[image.bufferView];
  if (!view || image.uri) throw new Error('avatar_v2_unexpected_embedded_image');
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.mimeType];
  if (!ext) throw new Error('avatar_v2_unknown_image_type');
  const relative = `images/image-${String(index).padStart(2, '0')}.${ext}`;
  outputs.set(relative, parsed.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
  delete image.bufferView;
  image.uri = relative;
}
document.buffers[0].uri = 'avatar.bin';
outputs.set('avatar.gltf', Buffer.from(JSON.stringify(document)));
outputs.set('THIRD_PARTY_NOTICES.md', await readFile(join(root, 'THIRD_PARTY_NOTICES.md')));
const destination = process.argv.find(arg => arg.startsWith('--destination='))?.slice('--destination='.length);
const targets = [join(root, 'assets'), ...(destination ? [resolve(destination)] : [])];
for (const [path, bytes] of outputs) manifest.files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
outputs.set('asset-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
for (const target of targets) {
  await mkdir(join(target, 'images'), { recursive: true });
  for (const [path, bytes] of outputs) await writeFile(join(target, path), bytes);
}
console.log(JSON.stringify({ code: 'AVATAR_V2_ASSETS_READY', sourceModelSha256: sourceHash, meshCount: manifest.meshCount,
  joints: manifest.jointCount, morphs: manifest.morphNames.length, embeddedImages: document.images.length, files: outputs.size, destinations: targets }));
