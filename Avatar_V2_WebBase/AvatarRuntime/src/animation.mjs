import * as THREE from 'three';
import { boneName } from './actor.mjs';
import { clamp, damp, lerp, smoothstep, angleDelta } from './math.mjs';

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
export const LOCOMOTION_PROFILE = Object.freeze({
  walkSpeed: 2.25, runSpeed: 6.2, walkStrideScale: 1.18, runStrideScale: 1.36,
  walkHalfStance: 0.085, runHalfStance: 0.08, pelvisRollScale: 0.28, pelvisYawScale: 0.55,
  minimumFootPitchDeg: -65, maximumFootPitchDeg: 45, maximumFootRollDeg: 2.5,
  minimumKneeFlexDeg: 16, minimumWalkKneeFlexDeg: 16, minimumRunKneeFlexDeg: 24,
  maximumWalkKneeFlexDeg: 75, maximumRunKneeFlexDeg: 125,
  stopBlendSharpness: 6,
});
const children = { hips: 'spine', spine: 'spine1', spine1: 'spine2', spine2: 'neck', neck: 'head',
  leftshoulder: 'leftarm', rightshoulder: 'rightarm', leftarm: 'leftforearm', rightarm: 'rightforearm', leftforearm: 'lefthand', rightforearm: 'righthand',
  lefthand: 'lefthandmiddle1', righthand: 'righthandmiddle1', leftupleg: 'leftleg', rightupleg: 'rightleg', leftleg: 'leftfoot', rightleg: 'rightfoot', leftfoot: 'lefttoebase', rightfoot: 'righttoebase' };
function depth(node) { let d = 0; while (node.parent) { d++; node = node.parent; } return d; }
function directionInBone(bone, name, map) {
  if (name === 'head') return new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(Q()).invert());
  let child = map.get(children[name]);
  if (!child) child = bone.children.find(n => n.isBone || /hand|finger|toe|headtop/i.test(n.name));
  if (!child) return null;
  return bone.worldToLocal(child.getWorldPosition(V())).normalize();
}
function anatomicalFrame(bone, direction, reference = Q()) {
  // Use a second anatomical axis to preserve bone roll, not only segment direction.
  const y = direction.clone().normalize(), inv = bone.getWorldQuaternion(Q()).invert();
  let z = new THREE.Vector3(0, 0, 1).applyQuaternion(reference).applyQuaternion(inv);
  z.addScaledVector(y, -z.dot(y));
  if (z.lengthSq() < 0.01) { z.set(0, 1, 0).applyQuaternion(inv); z.addScaledVector(y, -z.dot(y)); }
  if (z.lengthSq() < 0.001) { z.set(1, 0, 0); z.addScaledVector(y, -z.dot(y)); }
  z.normalize(); const x = new THREE.Vector3().crossVectors(y, z).normalize(); z.crossVectors(x, y).normalize();
  return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function buildSource(pack) {
  const root = new THREE.Group(), nodes = pack.nodes.map((data, i) => {
    const n = new THREE.Object3D(); n.name = data.name || `source_${i}`;
    if (data.matrix) new THREE.Matrix4().fromArray(data.matrix).decompose(n.position, n.quaternion, n.scale);
    else { if (data.translation) n.position.fromArray(data.translation); if (data.rotation) n.quaternion.fromArray(data.rotation); if (data.scale) n.scale.fromArray(data.scale); }
    return n;
  });
  pack.nodes.forEach((data, i) => (data.children || []).forEach(j => nodes[i].add(nodes[j])));
  pack.roots.forEach(i => root.add(nodes[i])); root.updateMatrixWorld(true);
  const bones = new Map(nodes.filter(n => n.name).map(n => [boneName(n.name), n]));
  const clips = pack.clips.map(data => new THREE.AnimationClip(data.name, data.duration, data.tracks.map(t => {
    const ctor = t.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new ctor(`${nodes[t.node].uuid}.${t.path === 'rotation' ? 'quaternion' : 'position'}`, t.times, t.values, t.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear);
  })));
  return { root, bones, clips, mixer: new THREE.AnimationMixer(root) };
}

/** Bake source world rotations onto the actual target hierarchy. No raw root motion is retained.
 * Child-direction correction accommodates the source/target bone axes and A/T bind-pose differences.
 * The target's segment lengths and skin weights are never replaced with the source character's.
 */
export async function retargetMotions(actor, pack, progress = () => {}) {
  const source = buildSource(pack);
  actor.restore();
  const rootQ = actor.root.getWorldQuaternion(Q()), invRootQ = rootQ.clone().invert();
  const mapping = [];
  for (const [name, target] of actor.bones) {
    const src = source.bones.get(name); if (!src) continue;
    const from = directionInBone(target, name, actor.bones), to = directionInBone(src, name, source.bones);
    const correction = from && to && from.lengthSq() > 0.1 && to.lengthSq() > 0.1 ? anatomicalFrame(src, to).multiply(anatomicalFrame(target, from, rootQ).invert()) : Q();
    // Toe direction cannot determine a shoe's sole normal. The former anatomical-frame
    // mapping rolled both shoes about 47 degrees. Transfer rest-relative ankle/toe motion.
    if (/foot$|toebase$/.test(name)) correction.copy(src.getWorldQuaternion(Q())).invert().multiply(invRootQ.clone().multiply(target.getWorldQuaternion(Q())));
    mapping.push({ name, target, src, correction });
  }
  mapping.sort((a, b) => depth(a.target) - depth(b.target));
  if (mapping.length < 15) throw new Error(`Only ${mapping.length} bones matched the motion source. This rig needs a custom retarget map.`);
  const hip = actor.bones.get('hips'), srcHip = source.bones.get('hips');
  const sourceHeight = source.bones.get('head').getWorldPosition(V()).distanceTo(source.bones.get('leftfoot').getWorldPosition(V()));
  const targetHeight = actor.bones.get('head').getWorldPosition(V()).distanceTo(actor.bones.get('leftfoot').getWorldPosition(V()));
  const scale = targetHeight / sourceHeight, hipRestWorld = hip.getWorldPosition(V());
  const result = {};
  for (const clip of source.clips) {
    progress(clip.name); await new Promise(resolve => setTimeout(resolve, 0));
    source.mixer.stopAllAction(); const action = source.mixer.clipAction(clip); action.reset().play();
    source.mixer.setTime(0); source.root.updateMatrixWorld(true);
    const sourceHip0 = srcHip.getWorldPosition(V());
    const count = Math.ceil(clip.duration * 40), times = [], hipValues = [], outputs = new Map(mapping.map(m => [m.target.uuid, []])), feet = [], soleSupports = [];
    const worldQ = Q(), parentQ = Q(), desiredQ = Q();
    for (let frame = 0; frame <= count; frame++) {
      const t = frame === count ? 0 : frame * clip.duration / count;
      times.push(frame * clip.duration / count); source.mixer.setTime(t); source.root.updateMatrixWorld(true);
      actor.restore();
      for (const m of mapping) {
        m.src.getWorldQuaternion(worldQ); desiredQ.copy(rootQ).multiply(worldQ).multiply(m.correction);
        m.target.parent.getWorldQuaternion(parentQ);
        m.target.quaternion.copy(parentQ.invert()).multiply(desiredQ).normalize(); m.target.updateMatrixWorld(true);
      }
      const delta = (srcHip.getWorldPosition(V()).y - sourceHip0.y) * scale;
      hip.position.copy(hip.parent.worldToLocal(hipRestWorld.clone().add(new THREE.Vector3(0, delta, 0))));
      actor.refresh ? actor.refresh() : actor.root.updateMatrixWorld(true);
      constrainSoleFrames(actor, rootQ);
      for (const m of mapping) m.target.quaternion.toArray(outputs.get(m.target.uuid), outputs.get(m.target.uuid).length);
      hip.position.toArray(hipValues, hipValues.length);
      feet.push(actor.root.worldToLocal(actor.bones.get('leftfoot').getWorldPosition(V())));
      if (actor.measureFeet) {
        const soles = actor.measureFeet(), originY = actor.root.getWorldPosition(V()).y;
        for (const side of ['left', 'right']) soleSupports.push({ ankleY: soles[side].ankle[1] - originY, clearance: soles[side].soleMinY - originY });
      }
    }
    // Source frame zero is not a ground reference (especially in the running clip).
    // Rebase using actual deformed soles while retaining the original vertical bob/flight.
    const minimumAnkle = Math.min(...soleSupports.map(sample => sample.ankleY));
    const supportClearances = soleSupports.filter(sample => sample.ankleY < minimumAnkle + 0.018).map(sample => sample.clearance);
    const groundOffset = supportClearances.length ? Math.min(...supportClearances) : 0;
    if (Math.abs(groundOffset) > 1e-6) {
      const zero = hip.parent.worldToLocal(V()), offset = hip.parent.worldToLocal(new THREE.Vector3(0, -groundOffset, 0)).sub(zero);
      for (let i = 0; i < hipValues.length; i += 3) { hipValues[i] += offset.x; hipValues[i + 1] += offset.y; hipValues[i + 2] += offset.z; }
    }
    const tracks = mapping.map(m => new THREE.QuaternionKeyframeTrack(`${m.target.uuid}.quaternion`, times, outputs.get(m.target.uuid)));
    tracks.push(new THREE.VectorKeyframeTrack(`${hip.uuid}.position`, times, hipValues));
    const baked = new THREE.AnimationClip(clip.name, clip.duration, tracks);
    let phaseOffset = 0, maxZ = -Infinity; feet.slice(0, -1).forEach((f, i) => { if (f.z > maxZ) { maxZ = f.z; phaseOffset = i / count; } });
    const minY = Math.min(...feet.map(p => p.y)), speeds = [];
    for (let i = 1; i < feet.length - 1; i++) {
      const speed = -(feet[i].z - feet[i - 1].z) / (clip.duration / count);
      if (feet[i].y < minY + 0.07 && speed > 0.3) speeds.push(speed);
    }
    speeds.sort((a, b) => a - b);
    const measured = speeds.length ? speeds[Math.floor(speeds.length * 0.5)] : (clip.name === 'run' ? 4.2 : 1.5);
    const strideScale = clip.name === 'run' ? LOCOMOTION_PROFILE.runStrideScale : clip.name === 'walk' ? LOCOMOTION_PROFILE.walkStrideScale : 1;
    const groundSpeed = (clip.name === 'run' ? clamp(measured, 2.8, 5.8) : clamp(measured, 1.0, 2.2)) * strideScale;
    result[clip.name] = { clip: baked, phaseOffset, groundSpeed, groundOffset, strideScale,
      stepsPerMinute: clip.name === 'idle' ? 0 : 120 * (clip.name === 'run' ? LOCOMOTION_PROFILE.runSpeed : LOCOMOTION_PROFILE.walkSpeed) / groundSpeed / clip.duration };
  }
  source.mixer.stopAllAction(); actor.restore();
  return { clips: result, matchedBones: mapping.length };
}

function rotateInWorld(bone, axis, angle) {
  if (!bone || Math.abs(angle) < 1e-7) return;
  const world = bone.getWorldQuaternion(Q()), parent = bone.parent.getWorldQuaternion(Q());
  world.premultiply(Q().setFromAxisAngle(axis, angle));
  bone.quaternion.copy(parent.invert()).multiply(world); bone.updateMatrixWorld(true);
}
function alignSegment(bone, currentDirection, desiredDirection) {
  if (currentDirection.lengthSq() < 1e-9 || desiredDirection.lengthSq() < 1e-9) return;
  const delta = Q().setFromUnitVectors(currentDirection.normalize(), desiredDirection.normalize());
  const world = bone.getWorldQuaternion(Q()).premultiply(delta), parent = bone.parent.getWorldQuaternion(Q());
  bone.quaternion.copy(parent.invert()).multiply(world); bone.updateMatrixWorld(true);
}
function solveLeg(upper, lower, foot, desired, weight, facing, constraint = null) {
  const h = upper.getWorldPosition(V()), k = lower.getWorldPosition(V()), a = foot.getWorldPosition(V());
  desired = a.clone().lerp(desired, weight);
  const l1 = h.distanceTo(k), l2 = k.distanceTo(a), axis = desired.clone().sub(h);
  const reachAtFlex = degrees => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(THREE.MathUtils.degToRad(degrees))));
  const minimumDistance = constraint ? reachAtFlex(constraint.maximumFlex) : 0.03;
  const maximumDistance = constraint ? reachAtFlex(constraint.minimumFlex) : l1 + l2 - 0.002;
  const rawDistance = axis.length(), distance = clamp(rawDistance, minimumDistance, maximumDistance); axis.normalize();
  desired.copy(h).addScaledVector(axis, distance);
  // A knee is a hinge. Do not inherit its bend plane from a retargeted source
  // pose after changing step width/length: that retained lateral/backward flips.
  let pole;
  if (constraint) {
    const forward = facing.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(constraint.poleYaw));
    const hinge = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
    pole = hinge.cross(axis);
    if (pole.dot(forward) < 0) pole.negate();
  } else pole = k.clone().sub(h).addScaledVector(axis, -k.clone().sub(h).dot(axis));
  if (pole.lengthSq() < 0.00001) pole.copy(facing).addScaledVector(axis, -facing.dot(axis));
  pole.normalize();
  const projected = (l1 * l1 + distance * distance - l2 * l2) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, l1 * l1 - projected * projected));
  const wantedKnee = h.clone().addScaledVector(axis, projected).addScaledVector(pole, bend);
  alignSegment(upper, k.clone().sub(h), wantedKnee.clone().sub(h));
  const kneeNow = lower.getWorldPosition(V()), ankleNow = foot.getWorldPosition(V());
  alignSegment(lower, ankleNow.clone().sub(kneeNow), desired.clone().sub(kneeNow));
}

export class MotionDirector {
  constructor(actor, retargeted, world) {
    this.actor = actor; this.world = world; this.mixer = new THREE.AnimationMixer(actor.model);
    this.clips = retargeted.clips; this.actions = {};
    for (const [name, data] of Object.entries(this.clips)) { this.actions[name] = this.mixer.clipAction(data.clip).play(); this.actions[name].setEffectiveWeight(name === 'idle' ? 1 : 0); }
    this.weights = { idle: 1, walk: 0, run: 0 }; this.phase = 0; this.time = 0; this.previousYaw = null; this.turn = 0;
    this.contacts = { left: { alpha: 0, locked: null, lockWeight: 0, releasing: false }, right: { alpha: 0, locked: null, lockWeight: 0, releasing: false } };
    this.ikEnabled = true; this.gazeEnabled = true; this.headLook = 0; this.airBlend = 0; this.breathing = true;
    this.gaitTargets = { left: null, right: null };
  }
  reset() {
    this.phase = 0; this.time = 0; this.turn = 0; this.previousYaw = null; this.headLook = 0; this.airBlend = 0;
    this.weights = { idle: 1, walk: 0, run: 0 };
    this.gaitTargets = { left: null, right: null };
    for (const contact of Object.values(this.contacts)) { contact.locked = null; contact.alpha = 0; contact.lockWeight = 0; contact.releasing = false; }
    this.actor.restore();
  }
  update(dt, physics, emotion, camera, portrait) {
    this.time += dt;
    const moving = smoothstep(0.02, 0.32, physics.speed), running = physics.state === 'run' ? 1 : 0;
    this.airBlend = damp(this.airBlend, physics.grounded ? 0 : 1, 12, dt);
    const targets = { idle: 1 - moving * (1 - this.airBlend), walk: moving * (1 - running) * (1 - this.airBlend), run: moving * running * (1 - this.airBlend) };
    let total = 0;
    const blendSharpness = physics.grounded && physics.state === 'idle' ? LOCOMOTION_PROFILE.stopBlendSharpness : 11;
    for (const key of Object.keys(this.weights)) { this.weights[key] = damp(this.weights[key], targets[key], blendSharpness, dt); total += this.weights[key]; }
    const gaitRunning = this.weights.run / Math.max(this.weights.walk + this.weights.run, 1e-6);
    const walk = this.clips.walk, run = this.clips.run;
    const rate = lerp(physics.speed / walk.groundSpeed / walk.clip.duration, physics.speed / run.groundSpeed / run.clip.duration, gaitRunning);
    if (physics.grounded) this.phase += rate * dt;
    for (const [key, action] of Object.entries(this.actions)) {
      action.enabled = true; action.setEffectiveWeight(this.weights[key] / Math.max(total, 1e-6));
      action.time = key === 'idle' ? this.time % this.clips.idle.clip.duration : ((this.phase + this.clips[key].phaseOffset) % 1) * this.clips[key].clip.duration;
    }
    this.mixer.update(0);
    const actor = this.actor, b = actor.bones;
    actor.refresh ? actor.refresh() : actor.root.updateMatrixWorld(true);
    const worldRotation = actor.root.getWorldQuaternion(Q());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(worldRotation), forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldRotation);
    const gaitWeight = (this.weights.walk + this.weights.run) / Math.max(total, 1e-6);
    if (gaitWeight > 0.001 && physics.grounded && !['land', 'landing', 'anticipation'].includes(physics.state)) this.athleticGait(gaitWeight, gaitRunning, right, forward, worldRotation, dt);
    else this.gaitTargets = { left: null, right: null };
    const yawRate = this.previousYaw === null ? 0 : angleDelta(this.previousYaw, physics.yaw) / Math.max(dt, 0.001);
    this.turn = damp(this.turn, clamp(yawRate, -4, 4), 7, dt); this.previousYaw = physics.yaw;
    const breath = this.breathing ? Math.sin(this.time * 1.45) : 0;
    rotateInWorld(b.get('spine2') || b.get('spine'), right, breath * 0.007 + gaitRunning * 0.025);
    rotateInWorld(b.get('spine1') || b.get('spine'), forward, -this.turn * Math.min(physics.speed, 4) * 0.007);
    let compression = physics.anticipation > 0 ? Math.sin((1 - physics.anticipation / 0.095) * Math.PI / 2) * 0.09 : 0;
    if (physics.landing > 0) compression += Math.sin((1 - physics.landing / 0.25) * Math.PI) * 0.10 * physics.impact;
    if (compression > 0.001) {
      const hip = b.get('hips'), p = hip.getWorldPosition(V()); p.y -= compression; hip.position.copy(hip.parent.worldToLocal(p)); actor.root.updateMatrixWorld(true);
      rotateInWorld(b.get('spine'), right, compression * 1.1);
      for (const side of ['left', 'right']) { rotateInWorld(b.get(side + 'upleg'), right, -compression * 2.4); rotateInWorld(b.get(side + 'leg'), right, compression * 4.5); rotateInWorld(b.get(side + 'arm'), right, compression * 2.0); }
    }
    if (this.airBlend > 0.01) {
      const tuck = smoothstep(-4.4, 0.5, physics.vy) * this.airBlend;
      for (const side of ['left', 'right']) {
        rotateInWorld(b.get(side + 'upleg'), right, -0.40 * tuck);
        rotateInWorld(b.get(side + 'leg'), right, 0.72 * tuck);
        rotateInWorld(b.get(side + 'foot'), right, -0.12 * tuck);
        rotateInWorld(b.get(side + 'arm'), right, -0.75 * this.airBlend);
        rotateInWorld(b.get(side + 'forearm'), right, -0.50 * this.airBlend);
      }
      rotateInWorld(b.get('spine2'), right, 0.08 * this.airBlend);
    }
    const headWorld = b.get('head').getWorldPosition(V()), cameraWorld = camera.getWorldPosition ? camera.getWorldPosition(V()) : camera.position.clone();
    const toCamera = cameraWorld.sub(headWorld);
    const relative = toCamera.clone().applyQuaternion(worldRotation.clone().invert());
    const look = this.gazeEnabled && relative.z > 0 && (portrait || physics.speed < 0.15) ? clamp(Math.atan2(relative.x, relative.z) * 0.26, -0.22, 0.22) : 0;
    this.headLook = damp(this.headLook, look, 4, dt); rotateInWorld(b.get('head'), new THREE.Vector3(0, 1, 0), this.headLook);
    const moodPitch = emotion === 'sad' ? 0.065 : emotion === 'surprise' ? -0.04 : emotion === 'laugh' ? Math.sin(this.time * 4.8) * 0.018 : 0;
    rotateInWorld(b.get('head'), right, moodPitch + breath * 0.003);
    constrainSoleFrames(actor, worldRotation);
    if (this.ikEnabled && physics.grounded) this.updateFeet(dt, physics, forward);
    else for (const c of Object.values(this.contacts)) { c.locked = null; c.alpha = 0; c.lockWeight = 0; c.releasing = false; }
    actor.root.updateMatrixWorld(true);
  }
  athleticGait(weight, running, right, forward, worldRotation, dt) {
    const a = this.actor, b = a.bones, hip = b.get('hips');
    const feet = Object.fromEntries(['left', 'right'].map(side => [side, a.root.worldToLocal(b.get(side + 'foot').getWorldPosition(V()))]));
    const restHip = a.rest.get(hip.uuid).q, current = worldRotation.clone().invert().multiply(hip.getWorldQuaternion(Q()));
    const motion = new THREE.Euler().setFromQuaternion(current.clone().multiply(restHip.clone().invert()), 'YXZ');
    rotateInWorld(hip, forward, -motion.z * (1 - LOCOMOTION_PROFILE.pelvisRollScale) * weight);
    rotateInWorld(hip, new THREE.Vector3(0, 1, 0), -motion.y * (1 - LOCOMOTION_PROFILE.pelvisYawScale) * weight);
    const hipPosition = hip.getWorldPosition(V());
    hipPosition.y -= lerp(0.055, 0.088, running) * weight;
    hip.position.copy(hip.parent.worldToLocal(hipPosition)); a.refresh();
    rotateInWorld(b.get('spine'), right, lerp(0.035, 0.085, running) * weight);
    const stride = lerp(LOCOMOTION_PROFILE.walkStrideScale, LOCOMOTION_PROFILE.runStrideScale, running);
    const lane = lerp(LOCOMOTION_PROFILE.walkHalfStance, LOCOMOTION_PROFILE.runHalfStance, running);
    for (const side of ['left', 'right']) {
      const foot = b.get(side + 'foot'), local = feet[side], savedQ = foot.getWorldQuaternion(Q()), sign = side === 'left' ? 1 : -1;
      const drive = clamp(local.z * 0.42, -0.18, 0.18) * weight;
      rotateInWorld(b.get(side + 'arm'), right, drive);
      rotateInWorld(b.get(side + 'arm'), forward, sign * lerp(0.045, 0.065, running) * weight);
      rotateInWorld(b.get(side + 'forearm'), right, -lerp(0.04, 0.19, running) * weight);
      local.x = lerp(local.x, sign * lane + local.x * 0.14, weight);
      local.z = lerp(local.z, clamp(local.z * stride, -0.57, 0.57), weight);
      if (!this.gaitTargets[side]) this.gaitTargets[side] = local.clone();
      this.gaitTargets[side].lerp(local, 1 - Math.exp(-35 * dt));
      local.copy(this.gaitTargets[side]);
      const target = a.root.localToWorld(local);
      solveLeg(b.get(side + 'upleg'), b.get(side + 'leg'), foot, target, 1, forward, kneeConstraint(running, side, weight));
      setWorldQuaternion(foot, savedQ);
    }
  }
  updateFeet(dt, physics, forward) {
    const a = this.actor;
    for (const side of ['left', 'right']) {
      const foot = a.bones.get(side + 'foot'), p = foot.getWorldPosition(V());
      const ground = this.world.groundAt(p.x, p.z, physics.y + 0.22), desiredY = ground + a.ankleOffsets[side];
      const contact = this.contacts[side], gap = p.y - desiredY;
      const desiredAlpha = physics.speed < 0.04 ? 1 : 1 - smoothstep(0.022, 0.13, gap);
      contact.alpha = damp(contact.alpha, desiredAlpha, 40, dt);
      if (desiredAlpha > 0.7 && !contact.locked && physics.speed > 0.1) { contact.locked = new THREE.Vector3(p.x, desiredY, p.z); contact.releasing = false; }
      if (desiredAlpha < 0.2 || physics.speed < 0.04 || (contact.locked && contact.locked.distanceTo(p) > 0.30)) contact.releasing = true;
      contact.lockWeight = damp(contact.lockWeight, contact.locked && !contact.releasing ? 1 : 0, 18, dt);
      if (contact.releasing && contact.lockWeight < 0.004) { contact.locked = null; contact.lockWeight = 0; contact.releasing = false; }
      const calibration = a.footCalibration?.[side];
      const footWorldQ = foot.getWorldQuaternion(Q());
      if (calibration) {
        const support = physics.speed < 0.04 ? 1 : contact.alpha;
        const flat = a.root.getWorldQuaternion(Q()).multiply(calibration.flatQuaternion);
        footWorldQ.slerp(flat, support); setWorldQuaternion(foot, footWorldQ);
        const toe = a.bones.get(side + 'toebase');
        if (toe) { toe.quaternion.slerp(calibration.toeRestQuaternion, support); toe.updateWorldMatrix(true, true); }
      }
      const measured = a.measureFeet?.()[side];
      const actualY = measured ? p.y + ground - measured.soleMinY : desiredY;
      const target = p.clone(); target.y = actualY;
      if (contact.locked) {
        const correction = contact.locked.clone().sub(p); correction.y = 0; correction.clampLength(0, 0.06);
        target.addScaledVector(correction, contact.lockWeight * contact.alpha * 0.78);
      }
      // A fading support blend may soften hovering corrections, but must never
      // soften an actual sole/ground penetration correction.
      if (measured && measured.soleMinY < ground) target.y = Math.max(target.y, actualY);
      const weight = (measured ? measured.soleMinY < ground : gap < 0) ? 1 : contact.alpha;
      if (weight > 0.015) {
        const gaitRunning = this.weights.run / Math.max(this.weights.walk + this.weights.run, 1e-6);
        const gaitWeight = (this.weights.walk + this.weights.run) / Math.max(this.weights.idle + this.weights.walk + this.weights.run, 1e-6);
        const constraint = gaitWeight > 0.001 && !['land', 'landing', 'anticipation'].includes(physics.state) ? kneeConstraint(gaitRunning, side, gaitWeight) : null;
        solveLeg(a.bones.get(side + 'upleg'), a.bones.get(side + 'leg'), foot, target, weight, forward, constraint);
        // IK rotates the calf; keep the calibrated shoe orientation independent of that rotation.
        setWorldQuaternion(foot, footWorldQ);
      }
    }
  }
}

function setWorldQuaternion(bone, world) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert()).multiply(world).normalize();
  bone.updateWorldMatrix(true, true);
}

function kneeConstraint(running, side, weight = 1) {
  return { minimumFlex: lerp(0, lerp(LOCOMOTION_PROFILE.minimumWalkKneeFlexDeg, LOCOMOTION_PROFILE.minimumRunKneeFlexDeg, running), weight),
    maximumFlex: lerp(175, lerp(LOCOMOTION_PROFILE.maximumWalkKneeFlexDeg, LOCOMOTION_PROFILE.maximumRunKneeFlexDeg, running), weight),
    poleYaw: side === 'left' ? 6 : -6 };
}

/** Reconstruct a shoe's anatomical frame, rather than clamping Euler angles of
 * a bone whose bind axes differ from the sole. Keep the source sagittal curve,
 * remove the swing inversion/twist and keep the sole's heel/toe skin coherent.
 */
function constrainSoleFrames(actor, worldRotation) {
  if (!actor.footCalibration) return;
  const up = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0), zAxis = new THREE.Vector3(0, 0, 1);
  for (const side of ['left', 'right']) {
    const calibration = actor.footCalibration[side], foot = actor.bones.get(side + 'foot');
    const delta = worldRotation.clone().invert().multiply(foot.getWorldQuaternion(Q())).multiply(calibration.restWorldQuaternion.clone().invert());
    const normal = up.clone().applyQuaternion(delta).applyAxisAngle(up, -calibration.flatHeading);
    // atan2(normal.z, normal.y) remains continuous through the former 90-degree
    // inversion; a YXZ Euler decomposition would swap yaw/roll by 180 degrees there.
    const pitch = clamp(Math.atan2(normal.z, normal.y), THREE.MathUtils.degToRad(LOCOMOTION_PROFILE.minimumFootPitchDeg), THREE.MathUtils.degToRad(LOCOMOTION_PROFILE.maximumFootPitchDeg));
    const roll = clamp(Math.atan2(-normal.x, Math.hypot(normal.y, normal.z)), -THREE.MathUtils.degToRad(LOCOMOTION_PROFILE.maximumFootRollDeg), THREE.MathUtils.degToRad(LOCOMOTION_PROFILE.maximumFootRollDeg));
    const desired = worldRotation.clone().multiply(Q().setFromAxisAngle(up, calibration.flatHeading))
      .multiply(Q().setFromAxisAngle(xAxis, pitch)).multiply(Q().setFromAxisAngle(zAxis, roll))
      .multiply(Q().setFromAxisAngle(up, -calibration.bindHeading)).multiply(calibration.restWorldQuaternion);
    setWorldQuaternion(foot, desired);
    const toe = actor.bones.get(side + 'toebase');
    if (toe) { toe.quaternion.copy(calibration.toeRestQuaternion); toe.updateWorldMatrix(true, true); }
  }
}
