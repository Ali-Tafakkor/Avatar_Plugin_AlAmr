import { createWebAvatarRuntime } from '../../../آواتار/src/web-v2/runtime.mjs';
import { retargetV1Clips } from './retarget.mjs';

/** Local experiment: same V2 model/face and original V2 jump; V1 owns other poses. */
export async function createMotionTestRuntime(gltf, motions, legacyGltf, options = {}) {
  const original = await createWebAvatarRuntime(gltf, motions, options);
  let mapped;
  try { mapped = retargetV1Clips(original.actor, legacyGltf); }
  catch (error) { original.dispose(); throw error; }
  const actor = original.actor;
  let preview = null, previewTime = 0, paused = false, timeScale = 1, disposed = false;
  let state = 'idle', jumpWeight = 0, landing = 0, previousGrounded = true, groundCorrection = 0;
  const jumpPose = new Map([...actor.bones.values()].map(b => [b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
  let pendingReset = false, lastFrame = null;
  function correctGround(frame) {
    groundCorrection = 0;
    if ((!preview && (!frame.locomotion.grounded || frame.pose.mode === 'flying')) || preview === 'Fly') return;
    const feet = actor.measureFeet();
    const left = options.groundAt?.(feet.left.ankle[0], feet.left.ankle[2], frame.pose.position[1] + 0.22) ?? 0;
    const right = options.groundAt?.(feet.right.ankle[0], feet.right.ankle[2], frame.pose.position[1] + 0.22) ?? 0;
    groundCorrection = Math.max(0, left - feet.left.soleMinY, right - feet.right.soleMinY);
    // A vertical pelvis correction preserves source limb angles. No athletic
    // gait/knee replacement from V2 is applied to V1 Walk/Run/Sitting.
    if (groundCorrection > 1e-7) {
      const hip = actor.bones.get('hips'), point = hip.getWorldPosition(hip.position.clone());
      point.y += groundCorrection; hip.position.copy(hip.parent.worldToLocal(point)); actor.refresh();
    }
  }
  const runtime = {
    root: original.root, actor, director: original.director, expressions: original.expressions, mapped,
    update(delta, frame) {
      if (disposed) return;
      lastFrame = frame;
      const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
      if (pendingReset) { original.reset(); pendingReset = false; }
      // Remove last frame's experimental local translations/scales before the
      // untouched V2 solver creates this frame's original jump reference.
      actor.restore(); original.update(dt, frame);
      for (const [bone, value] of jumpPose) { value.p.copy(bone.position); value.q.copy(bone.quaternion); value.s.copy(bone.scale); }
      state = frame.locomotion.state;
      if (preview) {
        if (!paused) previewTime += dt * timeScale;
        const clip = mapped.clips.get(preview);
        const once = ['HandRaise', 'StandToSit', 'SittoStand'].includes(preview);
        const sampleTime = once ? Math.min(previewTime, clip.duration) : previewTime % clip.duration;
        mapped.sample(preview, sampleTime); jumpWeight = 0; correctGround(frame);
      } else {
        mapped.source.driver.setMotion(frame.locomotion);
        if (!paused) mapped.source.driver.update(dt * timeScale);
        mapped.apply();
        const grounded = frame.locomotion.grounded;
        if (grounded && !previousGrounded) landing = 0.25;
        landing = Math.max(0, landing - dt); previousGrounded = grounded;
        const jump = frame.pose.mode !== 'flying' && state !== 'fly' && (!grounded || landing > 0);
        // In the airborne phase retain the exact original V2 pose. Blend only
        // back into the V1 performance at landing, where the new base differs.
        jumpWeight = jump ? 1 : Math.max(0, jumpWeight - dt / 0.16);
        if (frame.pose.mode === 'flying' || state === 'fly') jumpWeight = 0;
        if (jumpWeight > 0) {
          for (const [bone, value] of jumpPose) {
            bone.position.lerp(value.p, jumpWeight); bone.quaternion.slerp(value.q, jumpWeight); bone.scale.lerp(value.s, jumpWeight);
          }
          actor.refresh();
        }
        if (jumpWeight === 0) correctGround(frame);
      }
    },
    previewClip(name) {
      if (name !== null && !mapped.clips.has(name)) throw new Error('phase1_clip_unavailable_' + name);
      preview = name; previewTime = 0; jumpWeight = 0;
      if (name) { mapped.source.driver.preview(name); mapped.sample(name, 0); }
      else mapped.resume();
    },
    seekClip(seconds) {
      if (!preview) return;
      previewTime = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
      const clip = mapped.clips.get(preview), once = ['HandRaise', 'StandToSit', 'SittoStand'].includes(preview);
      mapped.sample(preview, once ? Math.min(previewTime, clip.duration) : previewTime % clip.duration);
      if (lastFrame) correctGround(lastFrame);
    },
    setPlayback(value) {
      if (typeof value.paused === 'boolean') paused = value.paused;
      if (Number.isFinite(value.timeScale) && value.timeScale >= 0) timeScale = value.timeScale;
    },
    setEmotion: name => original.setEmotion(name), setManual: (name, value) => original.setManual(name, value),
    setIntensity: value => original.setIntensity(value), setFaceOptions: value => original.setFaceOptions(value), blink: () => original.blink(),
    reset() {
      preview = null; previewTime = 0; jumpWeight = 0; landing = 0; previousGrounded = true; groundCorrection = 0;
      mapped.resume(); mapped.source.driver.setMotion({ state: 'idle', horizontalSpeed: 0 }); pendingReset = true;
    },
    getStatus() {
      const base = original.getStatus(), body = mapped.source.driver.getStatus();
      const clip = preview ?? body.clip;
      return { ...base, state, clip: jumpWeight ? base.clip : clip,
        mode: preview ? 'preview' : 'locomotion', time: preview ? Math.min(previewTime, mapped.clips.get(preview).duration) : body.time,
        duration: mapped.clips.get(clip)?.duration ?? base.duration,
        activeMotionSource: jumpWeight ? 'V2-original-jump' : 'V1-original-tracks-retargeted',
        mappingCount: mapped.mapping.length, matchedBones: mapped.mapping.length,
        jumpWeight, groundCorrection, rootMotionScale: mapped.rootScale,
        clips: [...mapped.clips].map(([name, value]) => ({ name, duration: value.duration })),
        feet: actor.measureFeet(), knees: actor.measureKnees(), disposed };
    },
    dispose() { if (disposed) return; disposed = true; mapped.dispose(); original.dispose(); },
  };
  return runtime;
}
