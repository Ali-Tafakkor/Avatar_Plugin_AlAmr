import { Quaternion, Vector3 } from 'three';

// These measurements read joint endpoints in each actor's own root frame.
// They intentionally do not reuse the retargeter's correction quaternions.
export const NON_JUMP_V1_CLIPS = Object.freeze([
  'Stand', 'Walk', 'Run', 'Fly', 'HandRaise', 'StandToSit', 'Sitting', 'SittoStand',
]);

export const BODY_SEGMENTS = Object.freeze([
  ['hips', 'spine'], ['spine', 'spine1'], ['spine1', 'spine2'],
  ['spine2', 'neck'], ['neck', 'head'], ['head', 'headtopend'],
  ...['left', 'right'].flatMap(side => [
    [side + 'shoulder', side + 'arm'], [side + 'arm', side + 'forearm'],
    [side + 'forearm', side + 'hand'], [side + 'hand', side + 'handindex1'],
    [side + 'hand', side + 'handthumb1'],
    [side + 'upleg', side + 'leg'], [side + 'leg', side + 'foot'],
    [side + 'foot', side + 'toebase'], [side + 'toebase', side + 'toeend'],
  ]),
]);

export const FINGER_SEGMENTS = Object.freeze(['left', 'right'].flatMap(side =>
  ['thumb', 'index'].flatMap(digit => [1, 2, 3].map(index =>
    [side + 'hand' + digit + index, side + 'hand' + digit + (index + 1)]))));

export const COMMON_SEGMENTS = Object.freeze([...BODY_SEGMENTS, ...FINGER_SEGMENTS]);

export function canonicalBoneName(name) {
  return name.split(/[|:]/).at(-1).toLowerCase().replace(/[^a-z0-9]/g, '')
    .replace(/^(mixamorig|armature)/, '');
}

export function readBones(root) {
  const bones = new Map();
  root.traverse(node => { if (node.isBone) bones.set(canonicalBoneName(node.name), node); });
  return bones;
}

export function capturePose({ root, bones = readBones(root) }) {
  root.updateWorldMatrix(true, true);
  const inverseRootRotation = root.getWorldQuaternion(new Quaternion()).invert();
  const rootOrigin = root.getWorldPosition(new Vector3());
  const result = new Map();
  for (const [rawName, bone] of bones) {
    result.set(canonicalBoneName(rawName), {
      // Strip host translation/heading, retaining the model's physical scale.
      position: bone.getWorldPosition(new Vector3()).sub(rootOrigin).applyQuaternion(inverseRootRotation),
      quaternion: inverseRootRotation.clone().multiply(bone.getWorldQuaternion(new Quaternion())),
      localScale: bone.scale.clone(),
    });
  }
  return result;
}

const direction = (pose, from, to) => {
  const a = pose.get(from), b = pose.get(to);
  return a && b ? b.position.clone().sub(a.position) : null;
};
const degreesBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1,
  a.dot(b) / Math.sqrt(a.lengthSq() * b.lengthSq())))) * 180 / Math.PI;

export function compareSegmentDirections(sourcePose, targetPose, segments = COMMON_SEGMENTS) {
  const values = [], missing = [], degenerate = [];
  for (const [from, to] of segments) {
    const name = from + '>' + to;
    const source = direction(sourcePose, from, to), target = direction(targetPose, from, to);
    if (!source || !target) { missing.push(name); continue; }
    if (source.lengthSq() < 1e-12 || target.lengthSq() < 1e-12) { degenerate.push(name); continue; }
    values.push({ name, degrees: degreesBetween(source, target), sourceLength: source.length(), targetLength: target.length() });
  }
  const sorted = values.map(value => value.degrees).sort((a, b) => a - b);
  return {
    count: values.length, missing, degenerate,
    meanDegrees: sorted.reduce((sum, value) => sum + value, 0) / Math.max(sorted.length, 1),
    p95Degrees: sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null,
    maxDegrees: sorted.at(-1) ?? null,
    segments: values,
  };
}

// Relative segment stretch measures preservation of animated translations and
// scales while allowing source and target to have different resting lengths.
export function compareSegmentStretch(sourcePose, targetPose, sourceReference, targetReference, segments = COMMON_SEGMENTS) {
  const values = [];
  for (const [from, to] of segments) {
    const s = direction(sourcePose, from, to), t = direction(targetPose, from, to);
    const sr = direction(sourceReference, from, to), tr = direction(targetReference, from, to);
    if (!s || !t || !sr || !tr || sr.lengthSq() < 1e-12 || tr.lengthSq() < 1e-12) continue;
    const sourceRatio = s.length() / sr.length(), targetRatio = t.length() / tr.length();
    values.push({ name: from + '>' + to, sourceRatio, targetRatio, error: Math.abs(sourceRatio - targetRatio) });
  }
  return { count: values.length, maxRatioError: Math.max(0, ...values.map(value => value.error)), segments: values };
}

// Palm normal uses thumb and index endpoints common to both rigs; using V2's
// middle finger as V1's hand axis would introduce a rig-specific bias.
export function comparePalmNormals(sourcePose, targetPose) {
  return ['left', 'right'].map(side => {
    const normal = pose => {
      const index = direction(pose, side + 'hand', side + 'handindex1');
      const thumb = direction(pose, side + 'hand', side + 'handthumb1');
      return index && thumb && index.lengthSq() > 1e-12 && thumb.lengthSq() > 1e-12
        ? index.normalize().cross(thumb.normalize()) : null;
    };
    const source = normal(sourcePose), target = normal(targetPose);
    return { side, degrees: source && target && source.lengthSq() > 1e-12 && target.lengthSq() > 1e-12
      ? degreesBetween(source, target) : null };
  });
}

export function compareRootRelativeHipMotion(sourcePose, targetPose, sourceReference, targetReference, scale) {
  const source = sourcePose.get('hips').position.clone().sub(sourceReference.get('hips').position).multiplyScalar(scale);
  const target = targetPose.get('hips').position.clone().sub(targetReference.get('hips').position);
  return { sourceDelta: source.toArray(), targetDelta: target.toArray(), error: source.distanceTo(target) };
}

export function finitePose(pose) {
  return [...pose.values()].every(value => [...value.position, ...value.quaternion, ...value.localScale].every(Number.isFinite));
}
