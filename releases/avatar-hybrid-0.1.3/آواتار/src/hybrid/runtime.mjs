import { Vector3, Quaternion } from 'three';
import { EMOTIONS, ExpressionState } from '../web-v2/expressions.mjs';
import { createHybridBodyRuntime } from './body-runtime.mjs';
import { createSculptedFace } from './sculpted-face.mjs';
import { SpeechCompositor } from '../speech/compositor.mjs';
import { createDetailedHands } from './detailed-hands.mjs';
import { createHandContact } from './hand-contact.mjs';
import { applyClothMaterials, applyMaterialStudy } from './surface-materials.mjs';

const pair = (name, value) => ({[name+'Left']:value,[name+'Right']:value});
const mood = (name, values) => ({...EMOTIONS[name],values:{...EMOTIONS[name].values,...values}});
const FRIENDLY = {
  ...EMOTIONS,
  neutral:mood('neutral',{browInnerUp:.14,...pair('browOuterUp',.20),...pair('eyeWide',.075),
    ...pair('mouthSmile',.14),...pair('cheekSquint',.055)}),
  smile:mood('smile',{browInnerUp:.13,...pair('browOuterUp',.21),
    ...pair('mouthSmile',.52),...pair('cheekSquint',.23),...pair('eyeSquint',.085),jawOpen:.045}),
  laugh:mood('laugh',{...pair('mouthSmile',1),...pair('cheekSquint',.55),...pair('eyeSquint',.36),
    ...pair('mouthUpperUp',.23),...pair('mouthLowerDown',.17),jawOpen:.46}),
};

/** Local phase2 facade. V1 owns the visible identity/body; V2 supplies facial
 * weights and the independent jump reference. The host still owns world pose. */
export async function createHybridRuntime(legacyGltf, webGltf, motions, options = {}) {
  const body = await createHybridBodyRuntime(legacyGltf, webGltf, motions, options);
  let transferred;
  try { transferred = await createSculptedFace(body, body.jumpDonor.actor, options); }
  catch (error) { body.dispose(); throw error; }
  body.refreshGeometryMeasurements?.();
  const expressions = new ExpressionState(options.friendlyFace === false ? EMOTIONS : FRIENDLY); expressions.setEmotion('neutral');
  const face = transferred.face;
  const appearance = options.faceAlbedo ? applyMaterialStudy({face}, options.faceAlbedo) : null;
  const hands = options.detailedHands === false ? null : createDetailedHands(body, body.jumpDonor.actor);
  const handContact = hands && options.handContact !== false ? createHandContact(body,hands,face,options.height) : null;
  handContact?.solve(0);
  const clothing = options.clothDetail === false ? null : applyClothMaterials(body);
  const speech = new SpeechCompositor();
  let disposed = false, inspectionFace = null, lastWeights = {}, lastFrame = null, cpuUpdateMs = 0;
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
    lastWeights = inspectionFace === null ? speech.compose(animated, dt) : { ...inspectionFace };
    face.apply(lastWeights);
  };
  const runtime = {
    root: body.root, model: body.model, actor, body, expressions, face,
    update(delta, frame) { if (!disposed) { const start=performance.now(); lastFrame = frame; handContact?.restore(); body.update(delta, frame); body.applyStaticContact?.(frame); hands?.update(delta); handContact?.solve(delta); transferred.update?.(delta, frame); applyFace(delta, frame); cpuUpdateMs=performance.now()-start; } },
    previewClip(name) { handContact?.restore(true); body.previewClip(name); if(name) handContact?.solve(0); },
    seekClip(seconds) { handContact?.restore(true); body.seekClip(seconds); if (lastFrame) body.applyStaticContact?.(lastFrame); handContact?.solve(0); transferred.update?.(0, lastFrame); },
    setPlayback(value) { body.setPlayback(value); },
    setEmotion(name) { inspectionFace = null; expressions.setEmotion(name); },
    setManual(group, amount) { inspectionFace = null; expressions.setManual(group, amount); },
    setIntensity(value) { if (Number.isFinite(value)) expressions.intensity = Math.max(0, Math.min(1, value)); },
    setFaceOptions(value) {
      for (const key of ['blinkEnabled', 'gazeEnabled', 'microEnabled']) if (typeof value[key] === 'boolean') expressions[key] = value[key];
    },
    setSpeechFrame(weights, frameOptions) { if (!disposed) { inspectionFace = null; speech.setFrame(weights, frameOptions); } },
    setSpeechOptions(value) { if (!disposed) speech.setOptions(value); },
    setLaughter(score, frameOptions) { if (!disposed) speech.setLaughter(score, frameOptions); },
    clearSpeech() { speech.clear(); },
    blink() { inspectionFace = null; expressions.blink(); },
    setHandPose(pose, side='both') { hands?.setPose(pose,side); },
    setFingerCurl(side,digit,value) { hands?.setFinger(side,digit,value); },
    setInspectionFace(weights) {
      inspectionFace = weights === null ? null : Object.fromEntries(Object.entries(weights).filter(([, value]) => Number.isFinite(value))
        .map(([name, value]) => [name, Math.max(0, Math.min(1, value))]));
      if (inspectionFace !== null) { lastWeights = { ...inspectionFace }; face.apply(lastWeights); }
    },
    reset() { handContact?.restore(true); body.reset(); inspectionFace = null; speech.clear(); hands?.setPose('auto'); },
    getStatus() {
      const status = body.getStatus();
      return { ...status, emotion: expressions.name, intensity: expressions.intensity, weights: { ...lastWeights },
        morphCount: face.shapes?.size ?? transferred.stats?.targets ?? 0,
        missingShapes: [...(face.missing ?? [])], faceTransfer: transferred.stats,
        inspectionFace: inspectionFace === null ? null : { ...inspectionFace }, speech: speech.getStatus(), hands:hands?.getStatus()??null, handContact:handContact?.getStatus()??null, clothing:clothing?.getStatus()??null, cpuUpdateMs, appearance:appearance?'accepted-face-2026-11-03':'source-materials', disposed };
    },
    hands, handContact,
    dispose() { if (disposed) return; disposed = true; speech.clear(); clothing?.dispose(); hands?.dispose(); appearance?.dispose(); transferred.dispose?.(); body.dispose(); },
  };
  return runtime;
}
