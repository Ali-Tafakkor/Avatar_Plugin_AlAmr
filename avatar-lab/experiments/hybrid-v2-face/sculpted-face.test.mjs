import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Quaternion, Vector3 } from 'three';
import { loadMotionFixtures } from '../v1-motion/tests/model-fixtures.mjs';
import { createHybridBodyRuntime } from './body-runtime.mjs';
import { createSculptedFace, sculptHeadPoint } from './sculpted-face.mjs';

const { legacy, web } = await loadMotionFixtures();
const motions = JSON.parse(await fs.readFile(new URL('../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions);
body.sample('Stand', 0);
const sculpture = createSculptedFace(body, body.jumpDonor.actor);
test.after(() => { sculpture.dispose(); body.dispose(); });

test('sculpture protects the neck anchor and remains a bounded orientation-preserving face warp', () => {
  const delta = 0.00001;
  for (let y = -0.15; y <= 0.20; y += 0.01) for (let x = -0.10; x <= 0.10; x += 0.01) for (let z = -0.08; z <= 0.16; z += 0.02) {
    const point = new Vector3(x, y, z), shaped = sculptHeadPoint(point);
    if (y <= -0.09) assert.deepEqual(shaped.toArray(), point.toArray());
    assert.ok(shaped.distanceTo(point) < 0.015);
    const columns = [new Vector3(delta, 0, 0), new Vector3(0, delta, 0), new Vector3(0, 0, delta)]
      .map(axis => sculptHeadPoint(point.clone().add(axis)).sub(shaped).divideScalar(delta));
    const determinant = columns[0].dot(columns[1].clone().cross(columns[2]));
    assert.ok(determinant > 0.80 && determinant < 1.25, 'no fold or extreme local stretch');
  }
});

test('native head assembly normals and full morph geometry remain finite and bounded', () => {
  assert.equal(sculpture.face.shapes.size, 66);
  assert.deepEqual(sculpture.face.missing, []);
  for (const mesh of sculpture.mounted.meshes) {
    const geometry = mesh.geometry;
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    for (let i = 0; i < geometry.attributes.normal.count; i++) {
      const length = new Vector3().fromBufferAttribute(geometry.attributes.normal, i).length();
      assert.ok(length > 0.99 && length < 1.01, mesh.name + ' unit normal');
    }
    for (const attribute of geometry.morphAttributes.position ?? []) {
      assert.ok(attribute.array.every(Number.isFinite));
      for (let i = 0; i < attribute.count; i++) assert.ok(new Vector3().fromBufferAttribute(attribute, i).length() < 0.10, mesh.name + ' bounded native morph');
    }
  }
});

test('native eyelids and lower teeth still undergo real nonzero blink/jaw displacement', () => {
  const head = body.bones.get('head'), native = sculpture.mounted.meshes.find(mesh => mesh.name === 'AvatarHead');
  const teeth = sculpture.mounted.meshes.find(mesh => mesh.name === 'AvatarTeethLower');
  const point = (mesh, index) => {
    sculpture.mounted.refresh(); mesh.skeleton.update();
    return mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld)
      .sub(head.getWorldPosition(new Vector3())).applyQuaternion(head.getWorldQuaternion(new Quaternion()).invert());
  };
  sculpture.face.apply({});
  const before = Array.from({ length: native.geometry.attributes.position.count }, (_, index) => point(native, index));
  const lower = Array.from({ length: teeth.geometry.attributes.position.count }, (_, index) => point(teeth, index));
  sculpture.face.apply({ eyeBlinkLeft: 1, eyeBlinkRight: 1 });
  assert.ok(Math.max(...before.map((p, index) => point(native, index).distanceTo(p))) > 0.008);
  sculpture.face.apply({ jawOpen: 0.52 });
  assert.ok(Math.max(...lower.map((p, index) => point(teeth, index).distanceTo(p))) > 0.01);
  sculpture.face.apply({});
  assert.ok(Math.max(...before.map((p, index) => point(native, index).distanceTo(p))) < 1e-10, 'neutral restores exact sculpted surface');
});
