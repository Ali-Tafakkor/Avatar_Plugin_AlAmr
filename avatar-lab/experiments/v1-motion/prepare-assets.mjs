import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseGLB } from '../../../آواتار/scripts/glb.mjs';
const source = new URL('../../../آواتار/assets-source/v1/avatar03.glb', import.meta.url);
const target = new URL('../../public/motion-test/reference/', import.meta.url);
const parsed = parseGLB(await readFile(source)), json = structuredClone(parsed.json);
await mkdir(target, { recursive: true });
json.buffers[0].uri = 'legacy.bin';
await writeFile(new URL('legacy.bin', target), parsed.binary);
for (const [index, image] of json.images.entries()) {
  const view = json.bufferViews[image.bufferView];
  const name = `image-${index}.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`;
  await writeFile(new URL(name, target), parsed.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  delete image.bufferView; image.uri = name;
}
await writeFile(new URL('legacy.gltf', target), JSON.stringify(json));
console.log(JSON.stringify({ code: 'PHASE1_LOCAL_REFERENCE_READY', animations: json.animations.length, sourceChanged: false }));
