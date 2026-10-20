import * as THREE from 'three';
import { createAvatar03Instance } from '../../../آواتار/dist/model.js';
import { Avatar03Animator } from '../../../آواتار/dist/motion.js';
import { boneName } from '../../../آواتار/src/web-v2/actor.mjs';

export const V1_CLIPS = Object.freeze(['Stand', 'Walk', 'Run', 'Fly', 'HandRaise', 'StandToSit', 'Sitting', 'SittoStand']);
const children = { hips: 'spine', spine: 'spine1', spine1: 'spine2', spine2: 'neck', neck: 'head', head: 'headtopend' };
for (const side of ['left', 'right']) {
  Object.assign(children, { [side + 'shoulder']: side + 'arm', [side + 'arm']: side + 'forearm',
    [side + 'forearm']: side + 'hand', [side + 'hand']: side + 'handindex1',
    [side + 'upleg']: side + 'leg', [side + 'leg']: side + 'foot',
    [side + 'foot']: side + 'toebase', [side + 'toebase']: side + 'toeend' });
  for (const digit of ['thumb', 'index']) for (let i = 1; i < 4; i++) children[`${side}hand${digit}${i}`] = `${side}hand${digit}${i + 1}`;
}
const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
function depth(node) { let n = 0; while (node.parent) { n++; node = node.parent; } return n; }
function pointInRoot(root, bone) {
  return bone.getWorldPosition(V()).sub(root.getWorldPosition(V())).applyQuaternion(root.getWorldQuaternion(Q()).invert());
}
function frame(root, bone, name, bones) {
  const child = bones.get(children[name]);
  if (!child) return null;
  const inverse = bone.getWorldQuaternion(Q()).invert();
  const y = child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).applyQuaternion(inverse).normalize();
  let z;
  if (/hand$/.test(name)) {
    const thumb = bones.get(name + 'thumb1');
    if (thumb) z = y.clone().cross(thumb.getWorldPosition(V()).sub(bone.getWorldPosition(V())).applyQuaternion(inverse)).normalize();
  }
  if (!z || z.lengthSq() < 1e-8) {
    const axis = /foot$|toebase$/.test(name) ? V().set(0, 1, 0) : V().set(0, 0, 1);
    z = axis.applyQuaternion(root.getWorldQuaternion(Q())).applyQuaternion(inverse);
    z.addScaledVector(y, -z.dot(y));
    if (z.lengthSq() < 1e-5) { z.set(0, 1, 0).applyQuaternion(root.getWorldQuaternion(Q())).applyQuaternion(inverse); z.addScaledVector(y, -z.dot(y)); }
    if (z.lengthSq() < 1e-5) { z.set(1, 0, 0).addScaledVector(y, -y.x); }
  }
  z.normalize();
  const x = y.clone().cross(z).normalize(); z.crossVectors(x, y).normalize();
  return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Samples original V1 tracks at their original precision and times. No resampling,
 * quaternion-only extraction or loop-closing rewrite is applied to one-shot clips. */
export function retargetV1Clips(actor, legacyGltf) {
  for (const name of V1_CLIPS) if (!legacyGltf.animations.some(c => c.name === name)) throw new Error('missing_v1_clip_' + name);
  const instance = createAvatar03Instance(legacyGltf, 1.78, 'scene');
  const source = { ...instance, bones: new Map() };
  source.model.traverse(node => { if (node.isBone) source.bones.set(boneName(node.name), node); });
  source.root.updateMatrixWorld(true); actor.restore();
  source.rest = new Map([...source.bones].map(([name, bone]) => [name, { p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }]));
  const sourceRestRootQ = source.root.getWorldQuaternion(Q()), targetRestRootQ = actor.root.getWorldQuaternion(Q());
  const mapping = [];
  for (const [name, target] of actor.bones) {
    const bone = source.bones.get(name); if (!bone) continue;
    const from = frame(source.root, bone, name, source.bones), into = frame(actor.root, target, name, actor.bones);
    // Leaf joints use rest-relative orientation. All visible limb segments use
    // a matched anatomical frame; palms use the common thumb/index plane.
    const correction = from && into ? from.multiply(into.invert())
      : bone.getWorldQuaternion(Q()).invert().multiply(sourceRestRootQ).multiply(targetRestRootQ.clone().invert()).multiply(target.getWorldQuaternion(Q()));
    const sourceParentName = boneName(bone.parent.name), targetCommonParent = actor.bones.get(sourceParentName);
    const bridge = targetCommonParent && target.parent !== targetCommonParent ? {
      sourceParent: bone.parent, targetParent: targetCommonParent,
      spanRatio: target.getWorldPosition(V()).distanceTo(targetCommonParent.getWorldPosition(V()))
        / bone.getWorldPosition(V()).distanceTo(bone.parent.getWorldPosition(V())),
    } : null;
    mapping.push({ name, source: bone, target, correction, bridge,
      translationRatio: target.position.length() / Math.max(bone.position.length(), 1e-8),
      sourceRest: source.rest.get(name), targetRest: actor.rest.get(target.uuid) });
  }
  mapping.sort((a, b) => depth(a.target) - depth(b.target));
  const chainLength = (root, bones, side) => pointInRoot(root, bones.get(side + 'upleg')).distanceTo(pointInRoot(root, bones.get(side + 'leg')))
    + pointInRoot(root, bones.get(side + 'leg')).distanceTo(pointInRoot(root, bones.get(side + 'foot')));
  const rootScale = chainLength(actor.root, actor.bones, 'left') / chainLength(source.root, source.bones, 'left');
  let targetHipReference = pointInRoot(actor.root, actor.bones.get('hips'));
  const driver = new Avatar03Animator(source.model, legacyGltf.animations);
  source.driver = driver; source.mixer = driver.mixer;
  source.root.updateMatrixWorld(true);
  const sourceHipReference = pointInRoot(source.root, source.bones.get('hips'));
  const clips = new Map(V1_CLIPS.map(name => [name, legacyGltf.animations.find(c => c.name === name)]));
  let disposed = false, sampledClip = null;

  function apply() {
    if (disposed) return;
    actor.restore(); source.root.updateMatrixWorld(true);
    const sourceInv = source.root.getWorldQuaternion(Q()).invert(), targetQ = actor.root.getWorldQuaternion(Q());
    for (const item of mapping) {
      const { source: bone, target, sourceRest, targetRest } = item;
      if (item.bridge) {
        // V2 has Neck1/Neck2 between Neck and Head; V1 animates that entire
        // span with one translation. Preserve the common endpoints, including
        // the seated neck shortening, rather than scaling only Neck2->Head.
        const span = bone.getWorldPosition(V()).sub(item.bridge.sourceParent.getWorldPosition(V()))
          .applyQuaternion(sourceInv).applyQuaternion(targetQ).multiplyScalar(item.bridge.spanRatio)
          .add(item.bridge.targetParent.getWorldPosition(V()));
        target.position.copy(target.parent.worldToLocal(span));
      } else if (item.name !== 'hips') {
        const delta = bone.position.clone().sub(sourceRest.p);
        // Position tracks are not rotations. Transfer their rest-relative changes
        // through the two parent frames, proportionally to this segment. A raw
        // component copy would bend the spine during the seated transitions.
        delta.applyQuaternion(bone.parent.getWorldQuaternion(Q())).applyQuaternion(sourceInv)
          .applyQuaternion(targetQ).applyQuaternion(target.parent.getWorldQuaternion(Q()).invert());
        target.position.copy(targetRest.p).addScaledVector(delta, item.translationRatio);
      }
      for (const axis of ['x', 'y', 'z']) target.scale[axis] = targetRest.s[axis] * bone.scale[axis] / sourceRest.s[axis];
      const desired = targetQ.clone().multiply(sourceInv).multiply(bone.getWorldQuaternion(Q())).multiply(item.correction);
      target.quaternion.copy(target.parent.getWorldQuaternion(Q()).invert()).multiply(desired).normalize();
      target.updateWorldMatrix(false, true);
    }
    const delta = pointInRoot(source.root, source.bones.get('hips')).sub(sourceHipReference).multiplyScalar(rootScale);
    const desired = targetHipReference.clone().add(delta).applyQuaternion(targetQ).add(actor.root.getWorldPosition(V()));
    const hip = actor.bones.get('hips'); hip.position.copy(hip.parent.worldToLocal(desired));
    actor.refresh();
  }
  function sample(name, time) {
    if (!clips.has(name)) throw new Error('unknown_phase1_clip_' + name);
    const clip = clips.get(name);
    // A deterministic exact sample, including t=duration, cannot use LoopRepeat.
    driver.mixer.stopAllAction();
    const action = driver.mixer.clipAction(clip); action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play(); action.time = Math.max(0, Math.min(time, clip.duration));
    driver.mixer.update(0); sampledClip = name; apply();
    return { name, time: action.time, duration: clip.duration };
  }
  // One common standing floor, rather than a per-clip floor correction that
  // would erase the pelvis descent of Sitting/StandToSit.
  apply();
  const sole = actor.measureFeet(), rootY = actor.root.getWorldPosition(V()).y;
  targetHipReference.y -= Math.min(sole.left.soleMinY, sole.right.soleMinY) - rootY;
  apply();
  return { clips, mapping, source, rootScale, apply, sample,
    get sampledClip() { return sampledClip; },
    resume() { sampledClip = null; driver.preview(null); },
    dispose() { if (disposed) return; disposed = true; driver.dispose(); instance.dispose(); },
  };
}
