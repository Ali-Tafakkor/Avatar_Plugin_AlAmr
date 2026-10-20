import { Group, LoopOnce, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { createAvatar03Instance } from '../model.js';
import { Avatar03Animator } from '../motion.js';
import { createWebAvatarRuntime } from '../web-v2/runtime.mjs';
import { boneName } from '../web-v2/actor.mjs';
import { fixLegacyPreviewMaterials } from './legacy-materials.mjs';

export const HYBRID_BODY_CLIPS = Object.freeze(['Stand', 'Walk', 'Run', 'Fly', 'HandRaise', 'StandToSit', 'Sitting', 'SittoStand']);
const ONCE = new Set(['HandRaise', 'StandToSit', 'SittoStand']);
const STATIC_CONTACT_CLIPS = new Set(['Stand', 'HandRaise', 'Sitting', 'StandToSit', 'SittoStand']);
const CHILDREN = { hips: 'spine', spine: 'spine1', spine1: 'spine2', spine2: 'neck', neck: 'head', head: 'headtopend' };
for (const side of ['left', 'right']) {
  Object.assign(CHILDREN, { [side + 'shoulder']: side + 'arm', [side + 'arm']: side + 'forearm',
    [side + 'forearm']: side + 'hand', [side + 'hand']: side + 'handindex1',
    [side + 'upleg']: side + 'leg', [side + 'leg']: side + 'foot',
    [side + 'foot']: side + 'toebase', [side + 'toebase']: side + 'toeend' });
  for (const digit of ['thumb', 'index']) for (let i = 1; i < 4; i++) CHILDREN[`${side}hand${digit}${i}`] = `${side}hand${digit}${i + 1}`;
}
const V = () => new Vector3(), Q = () => new Quaternion();
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function refresh(root) { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); }
function pointInRoot(root, bone) {
  return bone.getWorldPosition(V()).sub(root.getWorldPosition(V())).applyQuaternion(root.getWorldQuaternion(Q()).invert());
}
function depth(bone) { let result = 0; while (bone.parent) { result++; bone = bone.parent; } return result; }
function anatomicalFrame(root, bone, name, bones) {
  const child = bones.get(CHILDREN[name]); if (!child) return null;
  const inverse = bone.getWorldQuaternion(Q()).invert();
  const y = child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).applyQuaternion(inverse).normalize();
  let z;
  if (/hand$/.test(name)) {
    const thumb = bones.get(name + 'thumb1');
    if (thumb) z = y.clone().cross(thumb.getWorldPosition(V()).sub(bone.getWorldPosition(V())).applyQuaternion(inverse)).normalize();
  }
  if (!z || z.lengthSq() < 1e-8) {
    z = V().set(0, /foot$|toebase$/.test(name) ? 1 : 0, /foot$|toebase$/.test(name) ? 0 : 1)
      .applyQuaternion(root.getWorldQuaternion(Q())).applyQuaternion(inverse);
    z.addScaledVector(y, -z.dot(y));
    if (z.lengthSq() < 1e-6) { z.set(0, 1, 0).applyQuaternion(root.getWorldQuaternion(Q())).applyQuaternion(inverse); z.addScaledVector(y, -z.dot(y)); }
    if (z.lengthSq() < 1e-6) { z.set(1, 0, 0).addScaledVector(y, -y.x); }
  }
  z.normalize(); const x = y.clone().cross(z).normalize(); z.crossVectors(x, y).normalize();
  // Matrix construction through bone-independent axes accommodates A/T poses.
  const matrix = bone.matrixWorld.clone().identity().makeBasis(x, y, z);
  return Q().setFromRotationMatrix(matrix);
}

function createOwnedVisibleBody(gltf, height, lighting) {
  const instance = createAvatar03Instance(gltf, height, lighting);
  const originalMeshes = new Set(instance.meshes), meshes = [], bones = new Map();
  const geometries = new Map(), fallbackMaterials = new Set(), fallbackSkeletons = new Set();
  instance.model.traverse(node => {
    if (node.isBone) bones.set(boneName(node.name), node);
    if (!node.isMesh) return;
    meshes.push(node);
    if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
    node.geometry = geometries.get(node.geometry);
    // Node fixture loaders can use a second Three module instance. Avoid relying
    // on instanceof Mesh in the legacy helper when deciding resource ownership.
    if (!originalMeshes.has(node)) {
      const copy = material => { const result = material.clone(); fallbackMaterials.add(result); return result; };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
      if (node.skeleton) fallbackSkeletons.add(node.skeleton);
    }
    node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false;
  });
  fixLegacyPreviewMaterials(instance.root);
  const originalDispose = instance.dispose;
  instance.meshes = meshes;
  let disposed = false;
  instance.dispose = () => {
    if (disposed) return; disposed = true;
    for (const geometry of geometries.values()) geometry.dispose();
    for (const material of fallbackMaterials) material.dispose();
    for (const skeleton of fallbackSkeletons) skeleton.dispose();
    originalDispose();
  };
  return { instance, root: instance.root, model: instance.model, bones, meshes,
    refresh: () => refresh(instance.root), dispose: () => instance.dispose() };
}

function createSoleSampler(actor, height) {
  actor.refresh(); const samples = {}, flatCalibration = {};
  for (const side of ['left', 'right']) {
    const candidates = [];
    for (const mesh of actor.meshes.filter(mesh => mesh.isSkinnedMesh)) {
      const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
      for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
        let weight = 0;
        for (let c = 0; c < 4; c++) if (boneName(mesh.skeleton.bones[indices.getComponent(index, c)].name).startsWith(side)) weight += weights.getComponent(index, c);
        if (weight > 0.9) candidates.push({ mesh, index, point: mesh.getVertexPosition(index, V()).applyMatrix4(mesh.matrixWorld) });
      }
    }
    const minimum = Math.min(...candidates.map(item => item.point.y));
    const values = candidates.filter(item => item.point.y <= minimum + height * 0.00675);
    const origin = actor.bones.get(side + 'foot').getWorldPosition(V());
    const forward = actor.bones.get(side + 'toebase').getWorldPosition(V()).sub(origin); forward.y = 0; forward.normalize();
    const middle = values.reduce((sum, item) => sum + item.point.clone().sub(origin).dot(forward), 0) / values.length;
    samples[side] = values.map(({ mesh, index, point }) => ({ mesh, index, heel: point.clone().sub(origin).dot(forward) <= middle }));
    flatCalibration[side] = {
      // Capture native V1's actual neutral shoe orientation, rather than using
      // V2's different bind axes or copying a guessed Euler foot angle.
      flatRootQuaternion: actor.root.getWorldQuaternion(Q()).invert().multiply(actor.bones.get(side + 'foot').getWorldQuaternion(Q())),
      toeQuaternion: actor.bones.get(side + 'toebase').quaternion.clone(),
    };
  }
  const measure = () => {
    actor.refresh(); const result = {};
    for (const side of ['left', 'right']) {
      const values = samples[side].map(item => ({ heel: item.heel, y: item.mesh.getVertexPosition(item.index, V()).applyMatrix4(item.mesh.matrixWorld).y }));
      result[side] = { ankle: actor.bones.get(side + 'foot').getWorldPosition(V()).toArray(),
        heelY: Math.min(...values.filter(value => value.heel).map(value => value.y)),
        toeY: Math.min(...values.filter(value => !value.heel).map(value => value.y)),
        soleMinY: Math.min(...values.map(value => value.y)), soleMaxY: Math.max(...values.map(value => value.y)), sampleCount: values.length };
    }
    return result;
  };
  measure.flatCalibration = flatCalibration;
  return measure;
}

/** Visible V1 geometry and native 41-joint animation, with only V2's jump
 * anatomically mapped back onto the common joints. Facial geometry/control is
 * attached by the facade after construction; this module never writes morphs.
 */
export async function createHybridBodyRuntime(legacyGltf, webGltf, motions, options = {}) {
  const height = options.height ?? 1.78, actor = createOwnedVisibleBody(legacyGltf, height, options.lighting ?? 'scene');
  let jumpDonor;
  try { jumpDonor = await createWebAvatarRuntime(webGltf, motions, options); }
  catch (error) { actor.dispose(); throw error; }
  const donorHost = new Group(); donorHost.add(jumpDonor.root);
  const syncDonor = () => {
    actor.refresh(); donorHost.position.copy(actor.root.getWorldPosition(V())); donorHost.quaternion.copy(actor.root.getWorldQuaternion(Q()));
    donorHost.updateMatrixWorld(true);
  };
  syncDonor(); jumpDonor.actor.restore();
  const rest = new Map([...actor.bones].map(([name, bone]) => [name, { p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }]));
  const mapping = [];
  for (const [name, target] of actor.bones) {
    const source = jumpDonor.actor.bones.get(name); if (!source) continue;
    const sourceFrame = anatomicalFrame(jumpDonor.root, source, name, jumpDonor.actor.bones);
    const targetFrame = anatomicalFrame(actor.root, target, name, actor.bones);
    const correction = sourceFrame && targetFrame ? sourceFrame.multiply(targetFrame.invert())
      : source.getWorldQuaternion(Q()).invert().multiply(jumpDonor.root.getWorldQuaternion(Q()))
        .multiply(actor.root.getWorldQuaternion(Q()).invert()).multiply(target.getWorldQuaternion(Q()));
    const sourceRest = jumpDonor.actor.rest.get(source.uuid), targetRest = rest.get(name);
    const sourceCommonParent = jumpDonor.actor.bones.get(boneName(target.parent.name));
    const bridge = sourceCommonParent && boneName(source.parent.name) !== boneName(target.parent.name)
      ? { sourceParent: sourceCommonParent, spanRatio: target.getWorldPosition(V()).distanceTo(target.parent.getWorldPosition(V()))
        / source.getWorldPosition(V()).distanceTo(sourceCommonParent.getWorldPosition(V())) } : null;
    mapping.push({ name, source, target, sourceRest, targetRest, correction, bridge,
      translationRatio: target.getWorldPosition(V()).distanceTo(target.parent.getWorldPosition(V()))
        / Math.max(source.getWorldPosition(V()).distanceTo(source.parent.getWorldPosition(V())), 1e-8) });
  }
  mapping.sort((a, b) => depth(a.target) - depth(b.target));
  if (mapping.length !== actor.bones.size) { jumpDonor.dispose(); actor.dispose(); throw new Error('hybrid_jump_common_bone_missing'); }
  const legLength = (root, bones) => pointInRoot(root, bones.get('leftupleg')).distanceTo(pointInRoot(root, bones.get('leftleg')))
    + pointInRoot(root, bones.get('leftleg')).distanceTo(pointInRoot(root, bones.get('leftfoot')));
  const jumpScale = legLength(actor.root, actor.bones) / legLength(jumpDonor.root, jumpDonor.actor.bones);
  const sourceAnimator = new Avatar03Animator(actor.model, legacyGltf.animations);
  actor.refresh(); const targetHipReference = pointInRoot(actor.root, actor.bones.get('hips'));
  const camera = new PerspectiveCamera(); camera.position.set(0, 1.5, 5);
  jumpDonor.update(0, { pose: { position: [0, 0, 0], velocity: [0, 0, 0], yaw: 0, mode: 'grounded' },
    locomotion: { state: 'idle', grounded: true, horizontalSpeed: 0, verticalSpeed: 0 }, camera });
  const donorHipReference = pointInRoot(jumpDonor.root, jumpDonor.actor.bones.get('hips'));
  actor.measureFeet = createSoleSampler(actor, height);
  actor.measureKnees = () => {
    actor.refresh(); const result = {};
    for (const side of ['left', 'right']) {
      const hip = pointInRoot(actor.root, actor.bones.get(side + 'upleg')), knee = pointInRoot(actor.root, actor.bones.get(side + 'leg')), ankle = pointInRoot(actor.root, actor.bones.get(side + 'foot'));
      result[side] = { hip: hip.toArray(), knee: knee.toArray(), ankle: ankle.toArray(), flexDeg: knee.clone().sub(hip).angleTo(ankle.clone().sub(knee)) * 180 / Math.PI };
    }
    return result;
  };
  const clips = new Map(HYBRID_BODY_CLIPS.map(name => [name, legacyGltf.animations.find(clip => clip.name === name)]));
  let preview = null, previewTime = 0, paused = false, timeScale = 1, disposed = false, state = 'idle', jumpWeight = 0, landing = 0, previousGrounded = true;
  let staticContact = { active: false, reason: 'not_applied', feet: {} };
  const basePose = new Map([...actor.bones].map(([name, bone]) => [name, { p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }]));

  function applyJump() {
    for (const [name, bone] of actor.bones) { const value = rest.get(name); bone.position.copy(value.p); bone.quaternion.copy(value.q); bone.scale.copy(value.s); }
    actor.refresh();
    const sourceInverse = jumpDonor.root.getWorldQuaternion(Q()).invert(), targetRootQ = actor.root.getWorldQuaternion(Q());
    for (const item of mapping) {
      const { source, target, sourceRest, targetRest } = item;
      if (item.bridge) {
        const span = source.getWorldPosition(V()).sub(item.bridge.sourceParent.getWorldPosition(V())).applyQuaternion(sourceInverse)
          .applyQuaternion(targetRootQ).multiplyScalar(item.bridge.spanRatio).add(target.parent.getWorldPosition(V()));
        target.position.copy(target.parent.worldToLocal(span));
      } else if (item.name !== 'hips') {
        const delta = source.position.clone().sub(sourceRest.p).applyMatrix4(source.parent.matrixWorld).sub(source.parent.getWorldPosition(V()))
          .applyQuaternion(sourceInverse).applyQuaternion(targetRootQ).multiplyScalar(item.translationRatio);
        const origin = target.parent.getWorldPosition(V());
        delta.add(origin); target.position.copy(targetRest.p).add(target.parent.worldToLocal(delta));
      }
      for (const axis of ['x', 'y', 'z']) target.scale[axis] = targetRest.s[axis] * source.scale[axis] / sourceRest.s[axis];
      const desired = targetRootQ.clone().multiply(sourceInverse).multiply(source.getWorldQuaternion(Q())).multiply(item.correction);
      target.quaternion.copy(target.parent.getWorldQuaternion(Q()).invert()).multiply(desired).normalize(); target.updateWorldMatrix(false, true);
    }
    const hipDelta = pointInRoot(jumpDonor.root, jumpDonor.actor.bones.get('hips')).sub(donorHipReference).multiplyScalar(jumpScale);
    const targetPosition = targetHipReference.clone().add(hipDelta).applyQuaternion(targetRootQ).add(actor.root.getWorldPosition(V()));
    const hip = actor.bones.get('hips'); hip.position.copy(hip.parent.worldToLocal(targetPosition)); actor.refresh();
  }
  function samplePose(name, time) {
    const clip = clips.get(name); if (!clip) throw new Error('hybrid_body_clip_unavailable_' + name);
    sourceAnimator.mixer.stopAllAction();
    const action = sourceAnimator.mixer.clipAction(clip); action.reset().setLoop(LoopOnce, 1);
    action.clampWhenFinished = true; action.play(); action.time = clamp(Number.isFinite(time) ? time : 0, 0, clip.duration);
    sourceAnimator.mixer.update(0); actor.refresh();
    return { name, time: action.time, duration: clip.duration };
  }
  const runtime = {
    ...actor, actor, instance: actor.instance, sourceAnimator, jumpDonor, jumpMapping: mapping, jumpScale, clips,
    update(delta, frame) {
      if (disposed) return;
      staticContact = { active: false, reason: 'not_applied', feet: {} };
      const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.1);
      syncDonor(); jumpDonor.update(dt, frame); state = frame.locomotion.state;
      if (preview) {
        if (!paused) previewTime += dt * timeScale;
        const duration = clips.get(preview).duration;
        samplePose(preview, ONCE.has(preview) ? Math.min(previewTime, duration) : previewTime % duration); jumpWeight = 0;
        previousGrounded = frame.locomotion.grounded; landing = 0;
        return;
      }
      const inAir = ['jump', 'fall', 'land'].includes(state) || (!frame.locomotion.grounded && frame.pose.mode !== 'flying');
      sourceAnimator.setMotion(inAir ? { state: 'idle', horizontalSpeed: 0 } : frame.locomotion);
      if (!paused) sourceAnimator.update(dt * timeScale);
      actor.refresh();
      for (const [name, value] of basePose) { const bone = actor.bones.get(name); value.p.copy(bone.position); value.q.copy(bone.quaternion); value.s.copy(bone.scale); }
      if (frame.locomotion.grounded && !previousGrounded) landing = 0.25;
      landing = Math.max(0, landing - dt); previousGrounded = frame.locomotion.grounded;
      const isJump = frame.pose.mode !== 'flying' && state !== 'fly' && (!frame.locomotion.grounded || landing > 0);
      jumpWeight = isJump ? 1 : Math.max(0, jumpWeight - dt / 0.16);
      if (frame.pose.mode === 'flying' || state === 'fly') jumpWeight = 0;
      if (jumpWeight > 0) {
        applyJump();
        if (jumpWeight < 1) for (const [name, value] of basePose) {
          const bone = actor.bones.get(name);
          bone.position.copy(value.p.clone().lerp(bone.position, jumpWeight));
          bone.quaternion.copy(value.q.clone().slerp(bone.quaternion, jumpWeight));
          bone.scale.copy(value.s.clone().lerp(bone.scale, jumpWeight));
        }
        actor.refresh();
      }
    },
    previewClip(name) {
      if (name !== null && !clips.has(name)) throw new Error('hybrid_body_clip_unavailable_' + name);
      preview = name; previewTime = 0; jumpWeight = 0; landing = 0;
      sourceAnimator.preview(name);
      if (name) samplePose(name, 0);
    },
    sample(name, time) {
      if (preview !== name) runtime.previewClip(name);
      previewTime = Math.max(0, Number.isFinite(time) ? time : 0);
      return samplePose(name, previewTime);
    },
    seekClip(seconds) {
      if (!preview) return;
      previewTime = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
      const duration = clips.get(preview).duration;
      return samplePose(preview, ONCE.has(preview) ? Math.min(previewTime, duration) : previewTime % duration);
    },
    setMotion(value) { sourceAnimator.setMotion(value); },
    setPlayback(value) {
      if (typeof value.paused === 'boolean') paused = value.paused;
      if (Number.isFinite(value.timeScale) && value.timeScale >= 0) timeScale = value.timeScale;
    },
    /** Optional explicit contact overlay. Call after update/seek; raw native
     * samples remain unchanged unless the facade deliberately requests it. */
    applyStaticContact(frame) {
      const selected = preview ?? sourceAnimator.getStatus().clip;
      if (disposed || jumpWeight > 0 || !frame?.locomotion?.grounded || frame.pose?.mode === 'flying'
        || ['jump', 'fall', 'land', 'fly'].includes(frame.locomotion.state) || !STATIC_CONTACT_CLIPS.has(selected)) {
        return (staticContact = { active: false, reason: 'moving_or_jump', feet: {} });
      }
      let measured = actor.measureFeet(); const feet = {};
      for (const side of ['left', 'right']) {
        const ankle = measured[side].ankle;
        const ground = options.groundAt?.(ankle[0], ankle[2], ankle[1] + 0.22) ?? 0;
        const foot = actor.bones.get(side + 'foot'), toe = actor.bones.get(side + 'toebase');
        const calibration = actor.measureFeet.flatCalibration[side];
        const current = foot.getWorldQuaternion(Q()), flat = actor.root.getWorldQuaternion(Q()).multiply(calibration.flatRootQuaternion);
        const up = V().set(0, 1, 0), normal = up.clone().applyQuaternion(current.clone().multiply(flat.invert())).normalize();
        const desired = Q().setFromUnitVectors(normal, up).multiply(current).normalize();
        const toeAngle = toe.quaternion.clone().normalize().angleTo(calibration.toeQuaternion.clone().normalize()) * 180 / Math.PI;
        foot.quaternion.copy(foot.parent.getWorldQuaternion(Q()).invert()).multiply(desired).normalize();
        toe.quaternion.copy(calibration.toeQuaternion);
        feet[side] = { groundY: Number.isFinite(ground) ? ground : 0, translationY: 0, limited: false,
          angleCorrectionDegrees: current.clone().normalize().angleTo(desired) * 180 / Math.PI, toeCorrectionDegrees: toeAngle,
          before: { heelY: measured[side].heelY, toeY: measured[side].toeY } };
      }
      actor.refresh(); measured = actor.measureFeet();
      // Native V1's idle includes a small heel lift. This explicitly requested
      // static overlay levels only ankle/toe rotations against native Stand0,
      // then corrects each ankle's residual Y. Root/pelvis/knees, moving gait
      // and the V2 jump remain outside this optional contact owner.
      for (let iteration = 0; iteration < 3; iteration++) {
        let changed = false;
        for (const side of ['left', 'right']) {
          const values = feet[side], desired = values.groundY - measured[side].soleMinY;
          const shift = clamp(desired, -0.08 - values.translationY, 0.08 - values.translationY);
          values.limited ||= Math.abs(desired - shift) > 1e-7;
          if (Math.abs(shift) <= 1e-8) continue;
          const foot = actor.bones.get(side + 'foot'), point = foot.getWorldPosition(V());
          point.y += shift; foot.position.copy(foot.parent.worldToLocal(point));
          values.translationY += shift; changed = true;
        }
        if (!changed) break;
        actor.refresh(); measured = actor.measureFeet();
      }
      for (const side of ['left', 'right']) feet[side].after = {
        heelY: measured[side].heelY, toeY: measured[side].toeY, soleMinY: measured[side].soleMinY,
        heelResidual: measured[side].heelY - feet[side].groundY, toeResidual: measured[side].toeY - feet[side].groundY,
      };
      return (staticContact = { active: true, reason: 'native_static_ankle_height', clip: selected, feet });
    },
    /** Rebuild sample indices only at neutral Stand0 after facial authoring. */
    refreshGeometryMeasurements() {
      actor.measureFeet = createSoleSampler(actor, height); runtime.measureFeet = actor.measureFeet;
      staticContact = { active: false, reason: 'geometry_measurements_refreshed', feet: {} };
      return actor.measureFeet();
    },
    reset() { preview = null; previewTime = 0; jumpWeight = 0; landing = 0; previousGrounded = true; staticContact = { active: false, reason: 'reset', feet: {} }; jumpDonor.reset(); sourceAnimator.preview(null); sourceAnimator.setMotion({ state: 'idle', horizontalSpeed: 0 }); },
    getStatus() {
      const body = sourceAnimator.getStatus(), selected = preview ?? body.clip;
      return { ready: true, state, clip: jumpWeight ? jumpDonor.getStatus().clip : selected,
        mode: preview ? 'preview' : 'locomotion', time: preview ? Math.min(previewTime, clips.get(preview).duration) : body.time,
        duration: clips.get(selected)?.duration ?? 0, activeMotionSource: jumpWeight ? 'V2-jump-retargeted-to-V1' : 'V1-original-native-tracks',
        jumpWeight, staticContact, mappingCount: mapping.length, matchedBones: mapping.length, rootMotionScale: jumpScale,
        clips: [...clips].map(([name, clip]) => ({ name, duration: clip.duration })),
        feet: actor.measureFeet(), knees: actor.measureKnees(), stats: { meshes: actor.meshes.length, joints: actor.bones.size }, disposed };
    },
    dispose() { if (disposed) return; disposed = true; sourceAnimator.dispose(); jumpDonor.dispose(); actor.dispose(); },
  };
  return runtime;
}
