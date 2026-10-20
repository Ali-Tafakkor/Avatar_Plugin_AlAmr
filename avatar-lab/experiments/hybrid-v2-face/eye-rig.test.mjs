import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { loadMotionFixtures } from '../v1-motion/tests/model-fixtures.mjs';
import { createAvatar03Instance } from '../../../آواتار/dist/model.js';
import { Avatar03Animator } from '../../../آواتار/dist/motion.js';
import { prepareEyeApertures } from './eye-rig.mjs';

const { legacy } = await loadMotionFixtures();
const actor = createAvatar03Instance(legacy.gltf, 1.78, 'scene');
const animator = new Avatar03Animator(actor.model, legacy.gltf.animations);
actor.root.updateMatrixWorld(true);
let mesh;
actor.model.traverse(node => { if (node.isSkinnedMesh) mesh = node; });
mesh.skeleton.update();
const head = actor.model.getObjectByName('mixamorigHead');
const original = mesh.geometry;
const eyes = [
  { side: 'Left', center: [0.032, 0.1185, 0.110], radiusX: 0.019, radiusY: 0.009, lidUv: [0.682900, 0.159961] },
  { side: 'Right', center: [-0.032, 0.1185, 0.110], radiusX: 0.019, radiusY: 0.009, lidUv: [0.925593, 0.832690] },
];
const rig = prepareEyeApertures(mesh, { head, eyes });
const headPosition = head.getWorldPosition(new Vector3());
const headInverse = head.getWorldQuaternion(new Quaternion()).invert();
const neutral = Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => mesh.getVertexPosition(index, new Vector3())
  .applyMatrix4(mesh.matrixWorld).sub(headPosition).applyQuaternion(headInverse).toArray());
const closed = neutral.map(point => point.slice());
for (const { index, deltaHead } of Object.values(rig.blinkConstraints).flat()) {
  closed[index] = neutral[index].map((value, axis) => value + deltaHead[axis]);
}
test.after(() => { rig.dispose(); animator.dispose(); actor.dispose(); });

function front(x, y, indices, points) {
  let depth = -Infinity;
  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = [points[indices[index]], points[indices[index + 1]], points[indices[index + 2]]];
    const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-20) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
    if (Math.min(u, v, 1 - u - v) < -1e-7) continue;
    depth = Math.max(depth, u * a[2] + v * b[2] + (1 - u - v) * c[2]);
  }
  return depth;
}

test('neutral retains all original attributes, vertex IDs, material and skin', () => {
  for (const [name, attribute] of Object.entries(original.attributes)) {
    assert.deepEqual(mesh.geometry.attributes[name].array.subarray(0, attribute.array.length), attribute.array, name);
  }
  assert.ok(rig.stats.maximumNeutralInterpolationErrorMeters < 1e-6);
  for (const eye of rig.eyeMeshes) {
    assert.equal(eye.material, mesh.material); assert.equal(eye.skeleton, mesh.skeleton);
    assert.equal(Object.keys(eye.geometry.morphAttributes).length, 0);
  }
  const weights = mesh.geometry.attributes.skinWeight, joints = mesh.geometry.attributes.skinIndex;
  for (let index = original.attributes.position.count; index < weights.count; index++) {
    let sum = 0;
    for (let component = 0; component < 4; component++) {
      sum += weights.getComponent(index, component);
      assert.ok(Number.isInteger(joints.getComponent(index, component)));
    }
    assert.ok(Math.abs(sum - 1) < 1e-6, 'normalized skin weights');
  }
});

test('closed lid surfaces cover stationary original pupils across both eye apertures', () => {
  for (let eyeIndex = 0; eyeIndex < eyes.length; eyeIndex++) {
    const eye = eyes[eyeIndex]; let checked = 0, minimum = Infinity;
    for (let ix = -9; ix <= 9; ix++) for (let iy = -9; iy <= 9; iy++) {
      if ((ix / 10) ** 2 + (iy / 10) ** 2 > 0.8 ** 2) continue;
      const x = eye.center[0] + ix / 10 * eye.radiusX, y = eye.center[1] + iy / 10 * eye.radiusY;
      const ocular = front(x, y, rig.eyeMeshes[eyeIndex].geometry.index.array, neutral);
      if (!Number.isFinite(ocular)) continue;
      const lid = front(x, y, mesh.geometry.index.array, closed);
      minimum = Math.min(minimum, lid - ocular); checked++;
      assert.ok(lid > ocular + 0.00005, eye.side + ' exposed pupil at ' + ix + ',' + iy + ': ' + (lid - ocular));
    }
    assert.ok(checked > 150, eye.side + ' sampled coverage');
    console.log(eye.side + ' lid coverage: ' + checked + ' rays, minimum ' + (minimum * 1000).toFixed(3) + ' mm');
  }
});

test('fixed face rims and local covering strips avoid centimetre orbital bulges', () => {
  for (const eye of rig.stats.ocularTriangles) {
    assert.ok(eye.boundaryVertices > 100);
    assert.ok(eye.lidVertices > 100 && eye.lidTriangles > 100);
    assert.ok(eye.maximumLidDepthMeters < 0.005, eye.side + ' covering-strip depth ' + eye.maximumLidDepthMeters);
  }
  for (const entries of Object.values(rig.blinkConstraints)) {
    assert.ok(entries.filter(entry => entry.deltaHead.every(value => value === 0)).length > 100, 'original rim stays fixed');
    assert.ok(entries.every(entry => entry.deltaHead.every(Number.isFinite)));
  }
});

test('each closing lid stays inside one original skin UV sample', () => {
  const uv = mesh.geometry.attributes.uv;
  for (const eye of rig.stats.ocularTriangles) {
    const lids = rig.blinkConstraints['eyeBlink' + eye.side].slice(-eye.lidVertices);
    assert.ok(eye.lidUv.every(Number.isFinite));
    for (const { index } of lids) for (let component = 0; component < 2; component++) {
      assert.ok(Math.abs(uv.getComponent(index, component) - eye.lidUv[component]) < 1e-7,
        'adjacent lid triangles must not interpolate between atlas islands');
    }
  }
});
