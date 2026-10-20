import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Group, LoopOnce, PerspectiveCamera } from 'three';
import { createAvatar03Instance } from '../../../../آواتار/dist/model.js';
import { Avatar03Animator } from '../../../../آواتار/dist/motion.js';
import { createHybridBodyRuntime, HYBRID_BODY_CLIPS } from '../body-runtime.mjs';
import { loadMotionFixtures } from '../../v1-motion/tests/model-fixtures.mjs';
import { capturePose, compareSegmentDirections, readBones } from '../../v1-motion/tests/pose-metrics.mjs';

const { legacy, web } = await loadMotionFixtures();
const motions = JSON.parse(await fs.readFile(new URL('../../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
const transforms = bones => new Map([...bones].map(([name, bone]) => [name, {
  p: bone.position.toArray(), q: bone.quaternion.toArray(), s: bone.scale.toArray(),
}]));
const frame = (state = 'idle', grounded = true, y = 0, vy = 0, speed = 0, mode = 'grounded') => ({
  pose: { position: [8, 3.2 + y, -7], velocity: [0, vy, -speed], yaw: 1.8, mode },
  locomotion: { state, grounded, horizontalSpeed: speed, verticalSpeed: vy },
});
function makeFrame(...args) {
  const result = frame(...args); result.camera = new PerspectiveCamera(); result.camera.position.set(8, 4.7, -12); return result;
}
function exactSample(driver, clip, time) {
  driver.mixer.stopAllAction(); const action = driver.mixer.clipAction(clip);
  action.reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.time = time; driver.mixer.update(0);
}

test('visible V1 geometry owns its resources and all eight native clips reproduce every joint channel and true endpoint', async t => {
  const sourceBefore = capturePose({ root: legacy.gltf.scene }), materialBefore = JSON.stringify(legacy.gltf.scene.toJSON());
  const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions);
  const reference = createAvatar03Instance(legacy.gltf, 1.78, 'scene'), driver = new Avatar03Animator(reference.model, legacy.gltf.animations);
  try {
    const referenceBones = readBones(reference.root);
    assert.equal(body.meshes.length, 1); assert.equal(body.bones.size, 41);
    assert.deepEqual([...body.clips.keys()], [...HYBRID_BODY_CLIPS]);
    let cachedMesh; legacy.gltf.scene.traverse(node => { if (node.isSkinnedMesh) cachedMesh = node; });
    assert.notEqual(body.meshes[0].geometry, cachedMesh.geometry);
    assert.notEqual(body.meshes[0].material, cachedMesh.material);
    assert.deepEqual(body.meshes[0].geometry.attributes.position.array, cachedMesh.geometry.attributes.position.array);
    assert.deepEqual(body.meshes[0].geometry.attributes.skinIndex.array, cachedMesh.geometry.attributes.skinIndex.array);
    assert.deepEqual(body.meshes[0].geometry.attributes.skinWeight.array, cachedMesh.geometry.attributes.skinWeight.array);
    for (const name of HYBRID_BODY_CLIPS) {
      const clip = body.clips.get(name);
      for (let step = 0; step <= 8; step++) {
        const time = clip.duration * step / 8;
        const sample = body.sample(name, time); exactSample(driver, clip, time);
        assert.equal(sample.time, time); assert.equal(sample.duration, clip.duration);
        assert.deepEqual(transforms(body.bones), transforms(referenceBones), name + ' native channels at ' + time);
      }
    }
    body.sample('Stand', 0);
    const feet = body.getStatus().feet;
    for (const side of ['left', 'right']) {
      assert.ok(Math.abs(feet[side].heelY) < 0.001, side + ' native V1 standing heel');
      assert.ok(Math.abs(feet[side].toeY) < 0.001, side + ' native V1 standing toe');
    }
    t.diagnostic('Native V1 Stand0 heel/toe values in metres: ' + JSON.stringify(feet));
    assert.deepEqual(capturePose({ root: legacy.gltf.scene }), sourceBefore);
    assert.equal(JSON.stringify(legacy.gltf.scene.toJSON()), materialBefore, 'source materials/geometry/skeleton must remain untouched');
    assert.throws(() => body.previewClip('Jump'), /hybrid_body_clip_unavailable/);
  } finally { driver.dispose(); reference.dispose(); body.dispose(); }
});

test('V2 jumping directions map onto all 41 common V1 joints under a translated and rotated host, then release back to V1', async t => {
  const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions, { groundAt: () => 3.2 });
  const host = new Group(); host.position.set(8, 3.2, -7); host.rotation.y = 1.8; host.add(body.root);
  let worst = 0;
  try {
    for (let i = 0; i < 18; i++) body.update(1 / 60, makeFrame('run', true, 0, 0, 9));
    for (let i = 0; i < 35; i++) {
      const time = (i + 1) / 60, vy = 5.6 - 18.8 * time, y = Math.max(0, 5.6 * time - 9.4 * time * time);
      host.position.y = 3.2 + y; host.updateMatrixWorld(true);
      body.update(1 / 60, makeFrame(vy > 0 ? 'jump' : 'fall', false, y, vy, 9));
      assert.equal(body.getStatus().jumpWeight, 1);
      const report = compareSegmentDirections(capturePose(body.jumpDonor.actor), capturePose(body.actor));
      assert.deepEqual(report.missing, []);
      for (const value of report.segments.filter(value => !/hand.*(?:thumb|index)|toeend/.test(value.name))) worst = Math.max(worst, value.degrees);
    }
    assert.ok(worst < 0.001, 'common body direction error ' + worst);
    assert.equal(body.jumpMapping.length, 41);
    for (let i = 0; i < 36; i++) { host.position.y = 3.2; body.update(1 / 60, makeFrame()); }
    assert.equal(body.getStatus().jumpWeight, 0);
    assert.equal(body.getStatus().activeMotionSource, 'V1-original-native-tracks');
    t.diagnostic('Maximum common-joint V2-to-V1 jump segment angle: ' + worst + 'deg');
  } finally { body.dispose(); }
});

test('normal locomotion and Fly remain exactly native V1 and a second body does not share mutable geometry', async () => {
  const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions);
  const second = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions);
  const reference = createAvatar03Instance(legacy.gltf, 1.78, 'scene'), driver = new Avatar03Animator(reference.model, legacy.gltf.animations);
  const referenceBones = readBones(reference.root);
  try {
    assert.notEqual(body.meshes[0].geometry, second.meshes[0].geometry);
    assert.notEqual(body.meshes[0].material, second.meshes[0].material);
    for (const [state, grounded, mode, speed] of [['idle', true, 'grounded', 0], ['walk', true, 'grounded', 5], ['run', true, 'grounded', 9], ['fly', false, 'flying', 7]]) {
      for (let i = 0; i < 20; i++) {
        const value = makeFrame(state, grounded, 0, 0, speed, mode);
        body.update(1 / 60, value); driver.setMotion(value.locomotion); driver.update(1 / 60);
        assert.deepEqual(transforms(body.bones), transforms(referenceBones), state + ' native runtime pose');
        assert.equal(body.getStatus().jumpWeight, 0);
      }
    }
    body.previewClip('StandToSit'); body.setPlayback({ paused: true }); body.seekClip(body.clips.get('StandToSit').duration);
    const endpoint = transforms(body.bones); body.update(0.1, makeFrame()); assert.deepEqual(transforms(body.bones), endpoint);
    body.reset(); body.update(1 / 60, makeFrame()); assert.equal(body.getStatus().mode, 'locomotion');
  } finally { body.dispose(); second.dispose(); driver.dispose(); reference.dispose(); }
});

test('optional native contact plants heel and toe at every Stand clock while preserving all other joint rotations and root', async t => {
  const body = await createHybridBodyRuntime(legacy.gltf, web.gltf, motions, { groundAt: () => 3.2 });
  const host = new Group(); host.position.set(8, 3.2, -7); host.rotation.y = 1.8; host.add(body.root); host.updateMatrixWorld(true);
  let worst = 0, biggestOffset = 0;
  try {
    body.sample('Stand', 0); body.refreshGeometryMeasurements();
    for (let step = 0; step <= 40; step++) {
      body.sample('Stand', body.clips.get('Stand').duration * step / 40);
      const raw = transforms(body.bones), rootP = body.root.position.toArray(), rootQ = body.root.quaternion.toArray();
      const status = body.applyStaticContact(makeFrame());
      assert.equal(status.active, true);
      for (const side of ['left', 'right']) {
        const values = status.feet[side]; assert.equal(values.limited, false);
        worst = Math.max(worst, Math.abs(values.after.heelResidual), Math.abs(values.after.toeResidual));
        biggestOffset = Math.max(biggestOffset, Math.abs(values.translationY));
        assert.ok(Math.abs(values.after.heelResidual) < 0.002, side + ' heel');
        assert.ok(Math.abs(values.after.toeResidual) < 0.002, side + ' toe');
      }
      const corrected = transforms(body.bones);
      for (const [name, original] of raw) {
        if (!/foot$|toebase$/.test(name)) assert.deepEqual(corrected.get(name).q, original.q, name + ' original rotation');
        assert.deepEqual(corrected.get(name).s, original.s, name + ' original scale');
        if (!/foot$/.test(name)) assert.deepEqual(corrected.get(name).p, original.p, name + ' original translation');
      }
      assert.deepEqual(body.root.position.toArray(), rootP); assert.deepEqual(body.root.quaternion.toArray(), rootQ);
    }
    for (const clip of ['Walk', 'Run', 'Fly']) {
      body.sample(clip, body.clips.get(clip).duration * 0.4); const raw = transforms(body.bones);
      assert.equal(body.applyStaticContact(makeFrame()).active, false); assert.deepEqual(transforms(body.bones), raw);
    }
    body.sample('Stand', 0); const raw = transforms(body.bones);
    assert.equal(body.applyStaticContact(makeFrame('jump', false, 0.5, 2)).active, false); assert.deepEqual(transforms(body.bones), raw);
    t.diagnostic('Optional native contact: maximum heel/toe residual ' + worst + 'm; maximum ankle offset ' + biggestOffset + 'm');
  } finally { body.dispose(); }
});
