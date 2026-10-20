import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Vector3, Quaternion } from 'three';
import { loadMotionFixtures } from '../v1-motion/tests/model-fixtures.mjs';
import { createHybridBodyRuntime } from './body-runtime.mjs';
import { createFaceTransfer, FACE_GATE_SHAPES } from './face-transfer.mjs';

const { legacy, web } = await loadMotionFixtures();
const motions = JSON.parse(await fs.readFile(new URL('../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions);
body.sample('Stand', 0);
const original = body.meshes[0].geometry, originalAttributes = Object.fromEntries(Object.entries(original.attributes).map(([name, attribute]) => [name, attribute.array.slice()]));
const bonesBefore = [...body.bones].map(([name, bone]) => [name, ...bone.position, ...bone.quaternion, ...bone.scale]);
const transfer = createFaceTransfer(body, body.jumpDonor.actor);
const mesh = body.meshes[0], head = body.bones.get('head');
function headPoint(object, index) {
  body.root.updateWorldMatrix(true, true); body.root.updateMatrixWorld(true);
  return object.getVertexPosition(index, new Vector3()).applyMatrix4(object.matrixWorld).sub(head.getWorldPosition(new Vector3()))
    .applyQuaternion(head.getWorldQuaternion(new Quaternion()).invert());
}
test.after(() => { transfer.dispose(); body.dispose(); });

test('neutral retains exact original V1 vertex attributes/order, skeleton and eye surfaces', () => {
  for (const [name, array] of Object.entries(originalAttributes)) assert.deepEqual(mesh.geometry.attributes[name].array.subarray(0, array.length), array, name);
  assert.deepEqual([...body.bones].map(([name, bone]) => [name, ...bone.position, ...bone.quaternion, ...bone.scale]), bonesBefore);
  assert.equal(transfer.face.shapes.size, 5);
  assert.ok(transfer.stats.eyes.maximumNeutralInterpolationErrorMeters < 1e-6);
  assert.equal(transfer.eyeRig.eyeMeshes.length, 2);
  for (const eye of transfer.eyeRig.eyeMeshes) {
    assert.equal(eye.material, mesh.material); assert.equal(eye.skeleton, mesh.skeleton);
    assert.equal(Object.keys(eye.geometry.morphAttributes).length, 0, 'painted pupil surface must not stretch with blinking');
    assert.ok(eye.geometry.index.count > 100);
  }
});

test('real donor morph fields affect only the head and retain finite bounded geometric deltas', () => {
  assert.deepEqual(Object.keys(mesh.morphTargetDictionary), [...FACE_GATE_SHAPES]);
  for (const { name, affectedVertices, maximumMeters } of transfer.stats.shapes) {
    assert.ok(affectedVertices > 50, name); assert.ok(maximumMeters > 0.001 && maximumMeters < 0.05, name);
    const values = mesh.geometry.morphAttributes.position[mesh.morphTargetDictionary[name]].array;
    assert.ok(values.every(Number.isFinite), name);
    for (let index = 0; index < original.attributes.position.count; index++) {
      let headWeight = 0;
      for (let c = 0; c < 4; c++) if (mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(index, c)] === head) headWeight += mesh.geometry.attributes.skinWeight.getComponent(index, c);
      if (headWeight === 0) assert.deepEqual(Array.from(values.subarray(index * 3, index * 3 + 3)), [0, 0, 0], name + ' body vertex ' + index);
    }
  }
});

test('jaw opens a physically duplicated lip seam and drives actual lower teeth; blink closes lids over stationary original eyes', () => {
  const start = transfer.stats.originalVertices, end = start + transfer.stats.mouth.appendedVertices, groups = new Map();
  for (let index = start; index < end; index++) {
    const position = new Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index), key = position.toArray().map(value => Math.round(value * 1e9)).join(':');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(index);
  }
  transfer.face.apply({ jawOpen: 1 });
  let gap = 0;
  for (const indices of groups.values()) {
    const points = indices.map(index => headPoint(mesh, index));
    if (points.length > 1) gap = Math.max(gap, Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)));
  }
  assert.ok(gap > 0.015, 'real open lip gap in metres: ' + gap);
  const lower = body.model.getObjectByName('V1-mouth-AvatarTeethLower');
  assert.ok(lower && lower.morphTargetInfluences[lower.morphTargetDictionary.jawOpen] === 1);
  transfer.face.apply({});
  const eyeBefore = transfer.eyeRig.eyeMeshes.map(eye => headPoint(eye, eye.geometry.index.getX(0)).toArray());
  const neutral = Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => headPoint(mesh, index).toArray());
  transfer.face.apply({ eyeBlinkLeft: 1, eyeBlinkRight: 1 });
  for (const constraints of Object.values(transfer.eyeRig.blinkConstraints)) for (const { index, deltaHead } of constraints) {
    assert.ok(headPoint(mesh, index).distanceTo(new Vector3().fromArray(neutral[index]).add(new Vector3().fromArray(deltaHead))) < 2e-6, 'fixed rim and covering lid targets are honored by the skin Jacobian');
  }
  const front = (x, y, indices, points) => {
    let depth = -Infinity;
    for (let index = 0; index < indices.length; index += 3) {
      const [a, b, c] = [points[indices[index]], points[indices[index + 1]], points[indices[index + 2]]];
      const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-20) continue;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
      if (Math.min(u, v, 1 - u - v) >= -1e-7) depth = Math.max(depth, u * a[2] + v * b[2] + (1 - u - v) * c[2]);
    }
    return depth;
  };
  const closed = Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => headPoint(mesh, index).toArray());
  for (let eyeIndex = 0; eyeIndex < 2; eyeIndex++) {
    let checked = 0;
    for (let ix = -7; ix <= 7; ix++) for (let iy = -7; iy <= 7; iy++) {
      if ((ix / 10) ** 2 + (iy / 10) ** 2 > 0.7 ** 2) continue;
      const x = (eyeIndex === 0 ? 0.032 : -0.032) + ix * 0.0016, y = 0.114 + iy * 0.00075;
      const ocular = front(x, y, transfer.eyeRig.eyeMeshes[eyeIndex].geometry.index.array, neutral);
      if (!Number.isFinite(ocular)) continue;
      assert.ok(front(x, y, mesh.geometry.index.array, closed) > ocular + 0.00005, 'actual transferred blink must occlude original eye surface'); checked++;
    }
    assert.ok(checked > 100);
  }
  assert.deepEqual(transfer.eyeRig.eyeMeshes.map(eye => headPoint(eye, eye.geometry.index.getX(0)).toArray()), eyeBefore);
  transfer.face.apply({});
});
