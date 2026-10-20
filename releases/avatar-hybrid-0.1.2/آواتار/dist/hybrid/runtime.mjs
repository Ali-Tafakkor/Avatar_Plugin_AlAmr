import { Vector3, Quaternion } from 'three';
import { ExpressionState } from '../web-v2/expressions.mjs';
import { createHybridBodyRuntime } from './body-runtime.mjs';
import { createSculptedFace } from './sculpted-face.mjs';

/** Local phase2 facade. V1 owns the visible identity/body; V2 supplies facial
 * weights and the independent jump reference. The host still owns world pose. */
export async function createHybridRuntime(legacyGltf, webGltf, motions, options = {}) {
  const body = await createHybridBodyRuntime(legacyGltf, webGltf, motions, options);
  let transferred;
  try { transferred = await createSculptedFace(body, body.jumpDonor.actor, options); }
  catch (error) { body.dispose(); throw error; }
  body.refreshGeometryMeasurements?.();
  const expressions = new ExpressionState(); expressions.setEmotion('neutral');
  const face = transferred.face;
  let disposed = false, inspectionFace = null, lastWeights = {}, lastFrame = null;
  const eyePoint = new Vector3(), relative = new Vector3(), inverse = new Quaternion();
  const actor = body.actor ?? { root: body.root, model: body.model, bones: body.bones, meshes: body.meshes };
  actor.face = face;
  function eyes() {
    if (typeof transferred.eyes === 'function') return transferred.eyes();
    body.root.updateWorldMatrix(true, true);
    const head = body.bones.get('head');
    head.getWorldPosition(eyePoint);
    // Head-local physical offset, independent of V1's imported centimetre scale.
    return eyePoint.add(new Vector3(0, 0.11, 0.10).applyQuaternion(head.getWorldQuaternion(inverse)));
  }
  const applyFace = (delta, frame) => {
    const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
    let look = { x: 0, y: 0 };
    if (frame?.camera) {
      frame.camera.getWorldPosition(relative).sub(eyes());
      body.root.getWorldQuaternion(inverse).invert(); relative.applyQuaternion(inverse);
      if (relative.z > 0) look = {
        x: Math.max(-0.45, Math.min(0.45, Math.atan2(relative.x, relative.z) * 0.58)),
        y: Math.max(-0.35, Math.min(0.35, Math.atan2(relative.y, Math.hypot(relative.x, relative.z)) * 0.7)),
      };
    }
    const animated = expressions.update(dt, look);
    lastWeights = inspectionFace === null ? { ...animated } : { ...inspectionFace };
    face.apply(lastWeights);
  };
  const runtime = {
    root: body.root, model: body.model, actor, body, expressions, face,
    update(delta, frame) { if (!disposed) { lastFrame = frame; body.update(delta, frame); body.applyStaticContact?.(frame); transferred.update?.(delta, frame); applyFace(delta, frame); } },
    previewClip(name) { body.previewClip(name); },
    seekClip(seconds) { body.seekClip(seconds); if (lastFrame) body.applyStaticContact?.(lastFrame); transferred.update?.(0, lastFrame); },
    setPlayback(value) { body.setPlayback(value); },
    setEmotion(name) { inspectionFace = null; expressions.setEmotion(name); },
    setManual(group, amount) { inspectionFace = null; expressions.setManual(group, amount); },
    setIntensity(value) { if (Number.isFinite(value)) expressions.intensity = Math.max(0, Math.min(1, value)); },
    setFaceOptions(value) {
      for (const key of ['blinkEnabled', 'gazeEnabled', 'microEnabled']) if (typeof value[key] === 'boolean') expressions[key] = value[key];
    },
    blink() { inspectionFace = null; expressions.blink(); },
    setInspectionFace(weights) {
      inspectionFace = weights === null ? null : Object.fromEntries(Object.entries(weights).filter(([, value]) => Number.isFinite(value))
        .map(([name, value]) => [name, Math.max(0, Math.min(1, value))]));
      if (inspectionFace !== null) { lastWeights = { ...inspectionFace }; face.apply(lastWeights); }
    },
    reset() { body.reset(); inspectionFace = null; },
    getStatus() {
      const status = body.getStatus();
      return { ...status, emotion: expressions.name, intensity: expressions.intensity, weights: { ...lastWeights },
        morphCount: face.shapes?.size ?? transferred.stats?.targets ?? 0,
        missingShapes: [...(face.missing ?? [])], faceTransfer: transferred.stats,
        inspectionFace: inspectionFace === null ? null : { ...inspectionFace }, disposed };
    },
    dispose() { if (disposed) return; disposed = true; transferred.dispose?.(); body.dispose(); },
  };
  return runtime;
}
