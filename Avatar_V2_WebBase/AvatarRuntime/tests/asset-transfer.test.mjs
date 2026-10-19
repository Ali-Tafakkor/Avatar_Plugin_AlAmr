import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGLB } from '../scripts/glb.mjs';

test('Desktop asset extraction preserves every skin, morph, material and embedded image byte', async () => {
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-assets.mjs',import.meta.url))]);
  const original=parseGLB(await readFile(new URL('../assets/avatar.glb',import.meta.url)));
  const exported=JSON.parse(await readFile(new URL('../assets/avatar.gltf',import.meta.url),'utf8'));
  assert.deepEqual(await readFile(new URL('../assets/avatar.bin',import.meta.url)),original.binary);
  assert.equal(exported.images.length,14);
  for(let index=0;index<original.json.images.length;index++){
    const image=original.json.images[index],view=original.json.bufferViews[image.bufferView];
    const extracted=await readFile(new URL(`../assets/${exported.images[index].uri}`,import.meta.url));
    assert.deepEqual(extracted,original.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),`image ${index}`);
    delete exported.images[index].uri;exported.images[index].bufferView=image.bufferView;
  }
  delete exported.buffers[0].uri;
  assert.deepEqual(exported,original.json,'Only external resource URIs may change');
  assert.deepEqual(await readFile(new URL('../assets/motions.json',import.meta.url)),await readFile(new URL('../../AvatarMotionLab/assets/motions.json',import.meta.url)));
});
