import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Box3, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAvatar03Instance } from '../dist/model.js';
import { Avatar03Animator } from '../dist/motion.js';

// Geometry/animation tests use the real shipped GLB. Image decoding is stubbed;
// texture appearance is checked separately in the rendered Desktop preview.
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 4096, height: 4096, close() {} });
globalThis.ProgressEvent = class {};
const bytes = await fs.readFile(new URL('../dist/assets/avatar03.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
function bounds(instance) {
  instance.root.updateMatrixWorld(true);
  instance.root.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.update(); });
  return new Box3().setFromObject(instance.root, true);
}

test('real standing animation has feet on the floor and the requested height', () => {
  const instance = createAvatar03Instance(gltf, 1.78, 'scene');
  const driver = new Avatar03Animator(instance.model, gltf.animations);
  const box = bounds(instance);
  assert.ok(Math.abs(box.min.y) < 0.0001, `feet y=${box.min.y}`);
  assert.ok(Math.abs(box.getSize(new Vector3()).y - 1.78) < 0.0001);
  assert.equal(instance.meshes.length, 1);
  driver.update(0.1);
  assert.ok(Math.abs(bounds(instance).min.y) < 0.01, 'breathing must not make the character float');
  driver.dispose(); instance.dispose();
});

test('instances isolate skeletons/materials and preserve cached geometry and source pose', () => {
  const before = JSON.stringify(gltf.scene.toJSON());
  const first = createAvatar03Instance(gltf, 1.78, 'scene');
  const second = createAvatar03Instance(gltf, 1.78, 'unlit');
  assert.notEqual(first.meshes[0].skeleton, second.meshes[0].skeleton);
  assert.notEqual(first.meshes[0].material, second.meshes[0].material);
  assert.equal(first.meshes[0].geometry, second.meshes[0].geometry);
  assert.equal(first.meshes[0].material.type, 'MeshStandardMaterial');
  assert.equal(second.meshes[0].material.type, 'MeshBasicMaterial');
  const driver = new Avatar03Animator(first.model, gltf.animations);
  driver.preview('Sitting'); driver.update(0.1);
  assert.equal(JSON.stringify(gltf.scene.toJSON()), before);
  driver.dispose(); first.dispose(); second.dispose();
});
