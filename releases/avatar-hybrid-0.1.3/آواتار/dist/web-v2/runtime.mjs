import * as THREE from 'three';
import { createActorInstance } from './actor.mjs';
import { retargetMotions, MotionDirector, LOCOMOTION_PROFILE } from './animation.mjs';
import { ExpressionState, EMOTIONS, FACE_GROUPS } from './expressions.mjs';
import { clamp } from './math.mjs';

export { createActorInstance, retargetMotions, MotionDirector, ExpressionState, EMOTIONS, FACE_GROUPS, LOCOMOTION_PROFILE };

/** A host owns translation, camera, input and rendering; this instance owns its skeleton and face. */
export async function createWebAvatarRuntime(gltf, motionPack, options = {}) {
  const actor = createActorInstance(gltf, { height: options.height ?? 1.78, lighting: options.lighting ?? 'scene' });
  let retargeted;
  try { retargeted = await retargetMotions(actor, motionPack); }
  catch (error) { actor.dispose(); throw error; }
  const world = { groundAt: options.groundAt ?? (() => 0) };
  const director = new MotionDirector(actor, retargeted, world), expressions = new ExpressionState();
  let disposed = false, wasGrounded = true, landing = 0, lastVerticalSpeed = 0, currentState = 'idle';
  let lastPosition = null;
  const q = new THREE.Quaternion(), eyes = new THREE.Vector3(), relative = new THREE.Vector3();
  const physics = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, grounded: true,
    state: 'idle', anticipation: 0, landing: 0, impact: 0, flying: false };
  const reset = () => {
    director.reset(); landing = 0; lastVerticalSpeed = 0; wasGrounded = true; lastPosition = null;
  };
  const runtime = {
    root: actor.root, actor, director, expressions,
    update(delta, frame) {
      if (disposed) return;
      const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.1);
      const { pose, locomotion, camera } = frame;
      if (!pose || !locomotion || !camera) return;
      const p = pose.position;
      if (lastPosition && Math.hypot(p[0] - lastPosition[0], p[1] - lastPosition[1], p[2] - lastPosition[2]) > 2) reset();
      lastPosition = [p[0], p[1], p[2]];
      physics.x = p[0]; physics.y = p[1]; physics.z = p[2];
      physics.yaw = pose.yaw + Math.PI;
      physics.speed = Math.max(0, locomotion.horizontalSpeed ?? Math.hypot(pose.velocity[0], pose.velocity[2]));
      physics.vy = locomotion.verticalSpeed ?? pose.velocity[1];
      physics.grounded = locomotion.grounded;
      physics.flying = pose.mode === 'flying';
      physics.state = currentState = locomotion.state;
      if (physics.grounded && !wasGrounded) { landing = 0.25; physics.impact = Math.min(1, Math.abs(lastVerticalSpeed) / 5.6); }
      landing = Math.max(0, landing - dt); physics.landing = landing;
      wasGrounded = physics.grounded; lastVerticalSpeed = physics.vy;
      actor.root.updateWorldMatrix(true, true);
      director.update(dt, physics, expressions.name, camera, Boolean(frame.portrait));
      actor.root.updateWorldMatrix(true, true);
      eyes.copy(actor.eyes());
      actor.root.getWorldQuaternion(q);
      camera.getWorldPosition(relative).sub(eyes).applyQuaternion(q.invert());
      const horizontal = Math.hypot(relative.x, relative.z), front = relative.z > 0;
      actor.face.apply(expressions.update(dt, {
        x: front ? clamp(Math.atan2(relative.x, relative.z) * 0.58, -0.45, 0.45) : 0,
        y: front ? clamp(Math.atan2(relative.y, horizontal) * 0.7, -0.35, 0.35) : 0,
      }));
    },
    setEmotion(name) { expressions.setEmotion(name); },
    setManual(group, value) { expressions.setManual(group, value); },
    setIntensity(value) { expressions.intensity = clamp(value, 0, 1); },
    setFaceOptions(value) {
      for (const key of ['blinkEnabled', 'gazeEnabled', 'microEnabled']) if (typeof value[key] === 'boolean') expressions[key] = value[key];
      if (typeof value.gazeEnabled === 'boolean') director.gazeEnabled = value.gazeEnabled;
      if (typeof value.microEnabled === 'boolean') director.breathing = value.microEnabled;
      if (typeof value.ikEnabled === 'boolean') director.ikEnabled = value.ikEnabled;
    },
    blink() { expressions.blink(); }, reset,
    getStatus() {
      const clip = currentState === 'run' ? 'run' : currentState === 'walk' ? 'walk' : ['jump', 'fall', 'land', 'fly'].includes(currentState) ? currentState : 'idle';
      const action = director.actions[clip];
      return { ready: true, state: currentState, clip, time: action?.time ?? director.time,
        duration: retargeted.clips[clip]?.clip.duration ?? 0, emotion: expressions.name, intensity: expressions.intensity,
        weights: { ...expressions.weights }, morphCount: actor.face.shapes.size, matchedBones: retargeted.matchedBones,
        missingShapes: [...actor.face.missing], stats: { ...actor.stats }, feet: actor.measureFeet(), knees: actor.measureKnees(),
        profile: { ...LOCOMOTION_PROFILE }, disposed };
    },
    dispose() {
      if (disposed) return; disposed = true;
      director.mixer.stopAllAction(); director.mixer.uncacheRoot(actor.model); actor.dispose();
    },
  };
  return runtime;
}
