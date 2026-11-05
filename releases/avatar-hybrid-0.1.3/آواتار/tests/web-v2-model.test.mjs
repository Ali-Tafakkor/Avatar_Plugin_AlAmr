// Release regression: exercises the built Plugin modules, not the local prototype.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createActorInstance } from '../dist/web-v2/actor.mjs';
import { retargetMotions, MotionDirector, LOCOMOTION_PROFILE } from '../dist/web-v2/animation.mjs';
import { ExpressionState, EMOTIONS } from '../dist/web-v2/expressions.mjs';
import { loadRealAvatar } from './load-real-avatar.mjs';

const { gltf, motions } = await loadRealAvatar();
const base = createActorInstance(gltf), retargeted = await retargetMotions(base, motions);

test('extraction retains the real body, 73 joints, 66 facial shapes and five finger chains without shared mutable resources', () => {
  const copy = createActorInstance(gltf);
  assert.equal(copy.bones.size, 73); assert.equal(copy.face.shapes.size, 66);
  assert.equal(copy.meshes.length, 10); assert.equal(copy.stats.vertices, 32530);
  for (const source of base.meshes) {
    const mesh = copy.meshes.find(value => value.name === source.name);
    assert.notEqual(mesh.geometry, source.geometry); assert.notEqual(mesh.material, source.material);
    assert.deepEqual(mesh.geometry.attributes.position.array, source.geometry.attributes.position.array);
    assert.deepEqual(mesh.geometry.attributes.skinIndex.array, source.geometry.attributes.skinIndex.array);
    assert.deepEqual(mesh.geometry.attributes.skinWeight.array, source.geometry.attributes.skinWeight.array);
    assert.deepEqual(mesh.morphTargetDictionary, source.morphTargetDictionary);
    for (const [name, targets] of Object.entries(source.geometry.morphAttributes)) {
      assert.equal(mesh.geometry.morphAttributes[name].length, targets.length);
      for (let i = 0; i < targets.length; i++) assert.deepEqual(mesh.geometry.morphAttributes[name][i].array, targets[i].array);
    }
  }
  for (const side of ['left', 'right']) for (const digit of ['thumb', 'index', 'middle', 'ring', 'pinky'])
    assert.ok(copy.bones.has(`${side}hand${digit}1`));
  copy.bones.get('leftfoot').quaternion.identity();
  assert.notDeepEqual(copy.bones.get('leftfoot').quaternion.toArray(), base.bones.get('leftfoot').quaternion.toArray());
  let baseDisposed = false; base.meshes[0].geometry.addEventListener('dispose', () => { baseDisposed = true; });
  copy.dispose(); copy.dispose(); assert.equal(baseDisposed, false);
});

test('all original expression presets and blinking deform the same face targets after skeleton extraction', () => {
  const actor = createActorInstance(gltf), expressions = new ExpressionState();
  assert.equal(actor.face.missing.length, 0);
  const head = actor.meshes.find(mesh => mesh.name === 'AvatarHead');
  const samples = [];
  actor.face.apply({});
  for (let i = 0; i < head.geometry.attributes.position.count; i += 23) samples.push({ index: i, point: head.getVertexPosition(i, new THREE.Vector3()) });
  for (const emotion of Object.keys(EMOTIONS)) {
    expressions.setEmotion(emotion);
    for (let i = 0; i < 80; i++) actor.face.apply(expressions.update(1 / 60));
    if (emotion !== 'neutral') assert.ok(actor.face.bindings.some(binding => binding.node.morphTargetInfluences[binding.index] > 0.02), emotion);
    if (emotion === 'laugh') assert.ok(samples.some(sample => head.getVertexPosition(sample.index, new THREE.Vector3()).distanceTo(sample.point) > 0.003));
  }
  expressions.blink();
  for (let i = 0; i < 4; i++) actor.face.apply(expressions.update(1 / 60));
  assert.ok(expressions.weights.eyeBlinkLeft > 0.5);
  actor.dispose();
});

test('retarget baking is independent of host world translation and yaw', async () => {
  const actor = createActorInstance(gltf), parent = new THREE.Group();
  parent.position.set(-5, 2.6, 7); parent.rotation.y = 1.8; parent.add(actor.root);
  const transformed = await retargetMotions(actor, motions);
  for (const name of ['idle', 'walk', 'run']) {
    assert.ok(Math.abs(transformed.clips[name].groundSpeed - retargeted.clips[name].groundSpeed) < 0.0001, `${name} ground speed`);
    assert.ok(Math.abs(transformed.clips[name].groundOffset - retargeted.clips[name].groundOffset) < 0.0001, `${name} ground offset`);
    assert.ok(Math.abs(transformed.clips[name].phaseOffset - retargeted.clips[name].phaseOffset) < 0.0001, `${name} phase`);
    const originalHip = retargeted.clips[name].clip.tracks.at(-1).values, otherHip = transformed.clips[name].clip.tracks.at(-1).values;
    for (let i = 0; i < originalHip.length; i++) assert.ok(Math.abs(originalHip[i] - otherHip[i]) < 0.0001);
  }
  actor.dispose();
});

test('real skinned soles remain flat on the floor beneath a translated and rotated host', () => {
  const actor = base, parent = new THREE.Group(); parent.position.set(4, 3.2, -2); parent.rotation.y = 1.1; parent.add(actor.root);
  const director = new MotionDirector(actor, retargeted, { groundAt: () => 3.2 });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(4, 4.6, 1);
  const physics = { speed: 0, state: 'idle', grounded: true, vy: 0, y: 3.2, yaw: 1.1, anticipation: 0, landing: 0, impact: 0 };
  for (let frame = 0; frame < 120; frame++) director.update(1 / 120, physics, 'neutral', camera, false);
  const feet = actor.measureFeet();
  for (const side of ['left', 'right']) {
    assert.equal(feet[side].sampleCount, 199);
    assert.ok(Math.abs(feet[side].soleMinY - 3.2) < 0.00001, `${side}: ${feet[side].soleMinY}`);
    assert.ok(Math.abs(feet[side].rollDeg) < 0.01);
    assert.ok(Math.abs(feet[side].pitchDeg) < 0.01);
    // Tread curvature/thickness is retained, so all vertices need not share one Y.
    assert.ok(feet[side].soleMaxY - feet[side].soleMinY < 0.012);
  }
  director.mixer.stopAllAction(); actor.root.removeFromParent(); actor.restore();
});

test('faster athletic walk/run preserve support, separate foot lanes and use explicit host states', () => {
  const actor = base, director = new MotionDirector(actor, retargeted, { groundAt: () => 0 });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.5, 3);
  const physics = { speed: 0, state: 'idle', grounded: true, vy: 0, y: 0, yaw: 0, anticipation: 0, landing: 0, impact: 0 };
  assert.ok(retargeted.clips.walk.stepsPerMinute > 150);
  assert.ok(retargeted.clips.run.stepsPerMinute > 230);
  for (const state of ['walk', 'run']) {
    director.reset(); physics.state = state; physics.speed = state === 'walk' ? LOCOMOTION_PROFILE.walkSpeed : LOCOMOTION_PROFILE.runSpeed;
    let support = 0;
    for (let frame = 0; frame < 300; frame++) {
      actor.root.position.z += physics.speed / 120;
      director.update(1 / 120, physics, 'neutral', camera, false);
      const feet = actor.measureFeet();
      for (const side of ['left', 'right']) {
        assert.ok(feet[side].soleMinY > -0.003, `${state} ${side} frame ${frame}: ${feet[side].soleMinY}`);
        const ankle = actor.root.worldToLocal(new THREE.Vector3().fromArray(feet[side].ankle));
        assert.ok((side === 'left' ? 1 : -1) * ankle.x > 0.045, `${state} ${side} crossed at frame ${frame}`);
        if (director.contacts[side].alpha > 0.95 && frame > 30) {
          support++; assert.ok(Math.abs(feet[side].rollDeg) < 1.5, `${state} ${side} support roll: ${feet[side].rollDeg}`);
        }
      }
    }
    assert.ok(support > 15, `${state} support samples: ${support}`);
    assert.ok(director.weights[state] > 0.98, `${state} blend weights: ${JSON.stringify(director.weights)}`);
  }
  director.mixer.stopAllAction(); actor.root.position.set(0, 0, 0); actor.restore();
});

test('every baked and live swing frame stays upright with bounded anatomical roll/pitch and continuous rotations', () => {
  const actor = base, camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, 4);
  const assertFeet = (stage, previous = {}) => {
    const feet = actor.measureFeet();
    for (const side of ['left', 'right']) {
      const f = feet[side];
      assert.ok(Math.abs(f.rollDeg) <= 3, `${stage} ${side} roll ${f.rollDeg}`);
      assert.ok(f.pitchDeg >= -65.05 && f.pitchDeg <= 45.05, `${stage} ${side} pitch ${f.pitchDeg}`);
      assert.ok(f.normal[1] > 0.42, `${stage} ${side} inverted sole ${f.normal}`);
      const q = actor.bones.get(side + 'foot').getWorldQuaternion(new THREE.Quaternion());
      if (previous[side]) assert.ok(q.angleTo(previous[side]) < THREE.MathUtils.degToRad(14), `${stage} ${side} frame jump ${THREE.MathUtils.radToDeg(q.angleTo(previous[side]))}`);
      previous[side] = q;
      // Toe skin follows the ankle consistently, so the front half cannot invert separately.
      assert.ok(actor.bones.get(side + 'toebase').quaternion.angleTo(actor.footCalibration[side].toeRestQuaternion) < 0.00001);
    }
  };
  const mixer = new THREE.AnimationMixer(actor.model);
  for (const [name, data] of Object.entries(retargeted.clips)) {
    mixer.stopAllAction(); mixer.clipAction(data.clip).play(); const previous = {};
    const count = Math.ceil(data.clip.duration * 240);
    for (let frame = 0; frame <= count; frame++) {
      mixer.setTime(data.clip.duration * frame / count); actor.refresh(); assertFeet(`baked ${name} ${frame}`, previous);
    }
  }
  mixer.stopAllAction(); actor.restore();
  const director = new MotionDirector(actor, retargeted, { groundAt: () => 0 });
  const physics = { speed: 0, state: 'idle', grounded: true, vy: 0, y: 0, yaw: 0, anticipation: 0, landing: 0, impact: 0 };
  const previous = {};
  for (const stage of [ ['idle', 100], ['walk', 300], ['run', 500], ['walk', 200], ['jump', 120], ['fall', 120], ['land', 60], ['idle', 100] ]) {
    const [state, count] = stage; physics.state = state;
    physics.speed = state === 'walk' ? 2.25 : state === 'run' ? 6.2 : ['jump', 'fall'].includes(state) ? 2 : 0;
    physics.grounded = !['jump', 'fall'].includes(state); physics.vy = state === 'jump' ? 3 : state === 'fall' ? -3 : 0;
    for (let frame = 0; frame < count; frame++) {
      actor.root.position.z += physics.speed / 120;
      director.update(1 / 120, physics, 'laugh', camera, false); assertFeet(`live ${state} ${frame}`, previous);
    }
  }
  director.mixer.stopAllAction(); actor.root.position.set(0, 0, 0); actor.restore();
});

test('teleport reset clears all motion history without changing facial expression weights', () => {
  const actor = base, director = new MotionDirector(actor, retargeted, { groundAt: () => 0 });
  actor.face.apply({ mouthSmileLeft: 0.6, jawOpen: 0.4 });
  const faceBefore = actor.meshes.filter(mesh => mesh.morphTargetInfluences).map(mesh => [...mesh.morphTargetInfluences]);
  director.turn = 3; director.previousYaw = -2; director.headLook = 0.2; director.airBlend = 1; director.phase = 3; director.time = 9;
  director.weights = { idle: 0, walk: 0, run: 1 };
  for (const contact of Object.values(director.contacts)) { contact.locked = new THREE.Vector3(10, 0, 10); contact.alpha = 1; }
  director.reset();
  assert.equal(director.turn, 0); assert.equal(director.previousYaw, null); assert.equal(director.headLook, 0);
  assert.equal(director.airBlend, 0); assert.equal(director.phase, 0); assert.equal(director.time, 0);
  assert.deepEqual(director.weights, { idle: 1, walk: 0, run: 0 });
  for (const contact of Object.values(director.contacts)) { assert.equal(contact.locked, null); assert.equal(contact.alpha, 0); }
  assert.deepEqual(actor.meshes.filter(mesh => mesh.morphTargetInfluences).map(mesh => [...mesh.morphTargetInfluences]), faceBefore);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.5, 4); director.gazeEnabled = false;
  director.update(1 / 120, { speed: 0, state: 'idle', grounded: true, y: 0, yaw: 2.7, vy: 0, anticipation: 0, landing: 0, impact: 0 }, 'laugh', camera, false);
  assert.equal(director.turn, 0); assert.equal(director.previousYaw, 2.7);
  director.mixer.stopAllAction(); actor.restore();
});

test('all locomotion knees bend forward in a stable hinge plane, with bounded flex and smooth gait transitions', () => {
  const actor = base, parent = new THREE.Group(); parent.position.set(-2, 1.7, 4); parent.rotation.y = -0.8; parent.add(actor.root);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(1, 3, 7);
  const director = new MotionDirector(actor, retargeted, { groundAt: () => 1.7 });
  const physics = { speed: 2.25, state: 'walk', grounded: true, vy: 0, y: 1.7, yaw: -0.8, anticipation: 0, landing: 0, impact: 0 };
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(parent.quaternion), previous = {};
  const separations = { walk: { knees: [], ankles: [] }, run: { knees: [], ankles: [] } };
  for (const state of ['walk', 'run', 'walk']) {
    physics.state = state; physics.speed = state === 'run' ? 6.2 : 2.25;
    for (let frame = 0; frame < 600; frame++) {
      parent.position.addScaledVector(forward, physics.speed / 120);
      director.update(1 / 120, physics, 'neutral', camera, false);
      const knees = actor.measureKnees(), blend = director.weights.run / Math.max(director.weights.walk + director.weights.run, 1e-6);
      const gaitWeight = (director.weights.walk + director.weights.run) / Math.max(director.weights.idle + director.weights.walk + director.weights.run, 1e-6);
      const maximumFlex = 175 + (75 + 50 * blend - 175) * gaitWeight;
      for (const side of ['left', 'right']) {
        const knee = knees[side];
        assert.ok(knee.flexDeg >= 2.99 && knee.flexDeg <= maximumFlex + 0.01, `${state} ${frame} ${side} flex ${knee.flexDeg}, limit ${maximumFlex}`);
        assert.ok(knee.forwardBend > 0, `${state} ${frame} ${side} bent backward`);
        assert.ok(knee.planeDeviationDeg < 15, `${state} ${frame} ${side} plane ${knee.planeDeviationDeg}`);
        assert.ok((side === 'left' ? 1 : -1) * knee.knee[0] > 0.04, `${state} ${frame} ${side} knee crossed the center line`);
        if (previous[side]) assert.ok(Math.abs(knee.flexDeg - previous[side].flexDeg) < 12, `${state} ${frame} ${side} sudden flex change`);
        previous[side] = knee;
      }
      if (frame > 120) {
        separations[state].knees.push(knees.left.knee[0] - knees.right.knee[0]);
        separations[state].ankles.push(knees.left.ankle[0] - knees.right.ankle[0]);
      }
    }
  }
  const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const [state, values] of Object.entries(separations)) assert.ok(median(values.knees) > median(values.ankles) * 0.95, `${state}: knees collapsed inward`);
  director.mixer.stopAllAction(); actor.root.removeFromParent(); actor.root.position.set(0, 0, 0); actor.restore();
});

for (const hz of [30, 60, 120]) test(`real model remains continuous through accelerated walk/run/stop at ${hz} Hz`, () => {
  const actor = base, parent = new THREE.Group(); parent.position.set(2, 0.6, -4); parent.rotation.y = 0.65; parent.add(actor.root);
  const director = new MotionDirector(actor, retargeted, { groundAt: () => 0.6 }); director.gazeEnabled = false;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 4);
  const physics = { speed: 0, state: 'idle', grounded: true, vy: 0, y: 0.6, yaw: 0.65, anticipation: 0, landing: 0, impact: 0 };
  const dt = 1 / hz, previous = {};
  for (const [requested, duration] of [['idle', 0.25], ['walk', 2.5], ['run', 3], ['walk', 1.5], ['idle', 1.8]]) {
    const targetSpeed = requested === 'run' ? 6.2 : requested === 'walk' ? 2.25 : 0;
    for (let frame = 0; frame < Math.round(duration * hz); frame++) {
      const difference = targetSpeed - physics.speed, step = (difference > 0 ? 12 : 16) * dt;
      physics.speed += Math.sign(difference) * Math.min(Math.abs(difference), step);
      physics.state = physics.speed < 0.06 ? 'idle' : requested === 'run' ? 'run' : 'walk';
      if (requested === 'run') { parent.rotation.y += 0.25 * dt; physics.yaw = parent.rotation.y; }
      parent.position.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(parent.quaternion), physics.speed * dt);
      director.update(dt, physics, 'neutral', camera, false);
      const knees = actor.measureKnees(), feet = actor.measureFeet();
      for (const side of ['left', 'right']) {
        const k = knees[side], f = feet[side];
        assert.ok(k.forwardBend > 0, `${hz} Hz ${requested} ${frame} ${side}: backward knee`);
        assert.ok(k.planeDeviationDeg < 15, `${hz} Hz ${requested} ${frame} ${side}: knee plane`);
        if (previous[side]) assert.ok(Math.abs(k.flexDeg - previous[side].flexDeg) / dt < 1800, `${hz} Hz ${requested} ${frame} ${side}: knee angular discontinuity`);
        assert.ok(f.soleMinY > 0.599, `${hz} Hz ${requested} ${frame} ${side}: sole penetration ${f.soleMinY}`);
        assert.ok(Math.abs(f.rollDeg) < 3 && f.normal[1] > 0.42, `${hz} Hz ${requested} ${frame} ${side}: shoe inversion`);
        previous[side] = k;
      }
    }
  }
  assert.equal(physics.state, 'idle'); assert.ok(director.weights.idle > 0.99);
  director.mixer.stopAllAction(); actor.root.removeFromParent(); actor.root.position.set(0, 0, 0); actor.restore();
});

test.after(() => { base.dispose(); });
