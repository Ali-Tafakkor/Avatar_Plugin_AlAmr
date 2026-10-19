import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createActorInstance } from '../src/actor.mjs';
import { retargetMotions, MotionDirector, LOCOMOTION_PROFILE } from '../src/animation.mjs';
import { loadRealAvatar } from '../tests/load-real-avatar.mjs';

const { gltf, motions, bytes } = await loadRealAvatar();
const actor = createActorInstance(gltf), retargeted = await retargetMotions(actor, motions);
const parent = new THREE.Group(); parent.position.set(4, 3.2, -2); parent.rotation.y = 1.1; parent.add(actor.root);
const ground = 3.2, world = { groundAt: () => ground }, director = new MotionDirector(actor, retargeted, world);
const camera = new THREE.PerspectiveCamera(); camera.position.set(4, 4.6, 1);
const physics = { speed: 0, state: 'idle', grounded: true, vy: 0, y: ground, yaw: 1.1, anticipation: 0, landing: 0, impact: 0 };
const sha256 = data => createHash('sha256').update(data).digest('hex');
const sourceHashes = {};
for (const name of ['actor.mjs', 'animation.mjs', 'expressions.mjs', 'math.mjs']) sourceHashes[name] = sha256(await readFile(new URL('../src/' + name, import.meta.url)));
const report = { capturedAtUTC: new Date().toISOString(), sampleRateHz: 120, secondsPerState: 2,
  modelSha256: sha256(bytes), sourceHashes, profile: LOCOMOTION_PROFILE, matchedBones: retargeted.matchedBones, morphs: actor.face.shapes.size,
  calibration: Object.fromEntries(['left', 'right'].map(s => [s, { samples: actor.footCalibration[s].soleSamples.length, ankleOffset: actor.ankleOffsets[s] }])),
  clips: Object.fromEntries(Object.entries(retargeted.clips).map(([name, value]) => [name, { duration: value.clip.duration, groundSpeed: value.groundSpeed, groundOffset: value.groundOffset, stepsPerMinute: value.stepsPerMinute }])), poses: {} };
for (const state of ['idle', 'walk', 'run']) {
  physics.state = state; physics.speed = state === 'walk' ? LOCOMOTION_PROFILE.walkSpeed : state === 'run' ? LOCOMOTION_PROFILE.runSpeed : 0;
  director.reset(); let penetration = 0, worstSupportRoll = 0, maximumIdleSole = 0, crossed = 0, contactFrames = 0;
  let maximumRoll = 0, minimumPitch = Infinity, maximumPitch = -Infinity, lowestNormalY = 1, maximumFrameRotationDeg = 0;
  let minimumKneeFlex = Infinity, maximumKneeFlex = 0, maximumKneePlaneDeviation = 0, maximumLateralKneeBend = 0, backwardKnees = 0;
  let maximumKneeFlexFrameChange = 0, maximumKneePointStep = 0;
  const previousKnees = {}, kneeSpans = [], ankleSpans = [];
  const previousRotations = {};
  parent.position.set(4, 3.2, -2);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(parent.quaternion);
  let samples = [];
  for (let frame = 0; frame < 240; frame++) {
    parent.position.addScaledVector(forward, physics.speed / 120);
    director.update(1 / 120, physics, 'neutral', camera, false);
    const feet = actor.measureFeet(), knees = actor.measureKnees();
    kneeSpans.push(knees.left.knee[0] - knees.right.knee[0]); ankleSpans.push(knees.left.ankle[0] - knees.right.ankle[0]);
    for (const side of ['left', 'right']) {
      const f = feet[side]; penetration = Math.min(penetration, f.soleMinY - ground);
      const knee = knees[side]; minimumKneeFlex = Math.min(minimumKneeFlex, knee.flexDeg); maximumKneeFlex = Math.max(maximumKneeFlex, knee.flexDeg);
      if (previousKnees[side]) {
        maximumKneeFlexFrameChange = Math.max(maximumKneeFlexFrameChange, Math.abs(knee.flexDeg - previousKnees[side].flexDeg));
        maximumKneePointStep = Math.max(maximumKneePointStep, new THREE.Vector3().fromArray(knee.knee).distanceTo(new THREE.Vector3().fromArray(previousKnees[side].knee)));
      }
      previousKnees[side] = knee;
      maximumKneePlaneDeviation = Math.max(maximumKneePlaneDeviation, knee.planeDeviationDeg); maximumLateralKneeBend = Math.max(maximumLateralKneeBend, Math.abs(knee.lateralBend));
      if (knee.forwardBend < -0.00001) backwardKnees++;
      maximumRoll = Math.max(maximumRoll, Math.abs(f.rollDeg)); minimumPitch = Math.min(minimumPitch, f.pitchDeg); maximumPitch = Math.max(maximumPitch, f.pitchDeg);
      lowestNormalY = Math.min(lowestNormalY, f.normal[1]);
      const rotation = actor.bones.get(side + 'foot').getWorldQuaternion(new THREE.Quaternion());
      if (previousRotations[side]) maximumFrameRotationDeg = Math.max(maximumFrameRotationDeg, THREE.MathUtils.radToDeg(rotation.angleTo(previousRotations[side])));
      previousRotations[side] = rotation;
      const ankle = actor.root.worldToLocal(new THREE.Vector3().fromArray(f.ankle));
      if ((side === 'left' ? 1 : -1) * ankle.x < 0) crossed++;
      if (director.contacts[side].alpha > 0.95) { contactFrames++; worstSupportRoll = Math.max(worstSupportRoll, Math.abs(f.rollDeg)); }
      if (state === 'idle') maximumIdleSole = Math.max(maximumIdleSole, f.soleMinY - ground);
    }
    if (frame % 30 === 0) samples.push({ frame, feet, knees });
  }
  report.poses[state] = { penetration, worstSupportRoll, maximumIdleSole, crossed, contactFrames,
    maximumRoll, minimumPitch, maximumPitch, lowestNormalY, maximumFrameRotationDeg, samples };
  const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  report.poses[state].knees = { minimumKneeFlex, maximumKneeFlex, maximumKneePlaneDeviation, maximumLateralKneeBend, backwardKnees,
    maximumKneeFlexFrameChange, maximumKneePointStep, medianKneeSpan: median(kneeSpans), medianAnkleSpan: median(ankleSpans) };
}
if (process.argv.includes('--compact')) for (const pose of Object.values(report.poses)) delete pose.samples;
console.log(JSON.stringify(report, null, 2));
actor.dispose();
