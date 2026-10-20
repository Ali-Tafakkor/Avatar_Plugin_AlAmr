import { Quaternion, Vector3 } from 'three';

const STATIC_CLIPS = new Set(['Stand', 'HandRaise', 'Sitting', 'StandToSit', 'SittoStand']);
const AIR_STATES = new Set(['jump', 'fall', 'land', 'fly']);
const UP = new Vector3(0, 1, 0);

/** Static support correction after V1 retargeting, before host height handling.
 * Sole orientation comes from the existing shoe calibration. Only ankle/toe
 * rotations and a bounded world-vertical ankle offset are changed. No root,
 * pelvis, knee rotation, moving gait, flight or original V2 jump is solved here.
 */
export function createFootContact(actor, { groundAt = () => 0, maxTranslation = 0.08 } = {}) {
  if (!actor?.footCalibration?.left || !actor?.footCalibration?.right) throw new Error('foot_contact_requires_calibrated_shoes');
  let lastStatus = { active: false, reason: 'not_applied', feet: {} };
  const limit = Math.max(0, Number.isFinite(maxTranslation) ? maxTranslation : 0.08);
  const inactive = reason => (lastStatus = { active: false, reason, feet: {} });

  return {
    apply({ frame, clip, delta: _delta, preview = false } = {}) {
      const locomotion = frame?.locomotion;
      if (!locomotion?.grounded || frame?.pose?.mode === 'flying' || AIR_STATES.has(locomotion.state)) return inactive('air_or_flight');
      const isPreview = Boolean(preview), selected = typeof preview === 'string' ? preview : clip;
      if (!STATIC_CLIPS.has(selected)) return inactive('moving_or_unsupported_clip');
      if (!isPreview && ['walk', 'run'].includes(locomotion.state)) return inactive('moving_gait');

      actor.refresh();
      const before = actor.measureFeet(), feet = {};
      for (const side of ['left', 'right']) {
        const foot = actor.bones.get(side + 'foot'), toe = actor.bones.get(side + 'toebase');
        const calibration = actor.footCalibration[side];
        const current = foot.getWorldQuaternion(new Quaternion());
        // flatQuaternion defines the shoe's flat anatomical frame, including its
        // authored bone axes. A minimal swing levels its normal without forcing
        // the V1 heading to V2's fixed toe-out yaw or guessing an Euler offset.
        const relative = current.clone().multiply(calibration.flatQuaternion.clone().invert());
        const normal = UP.clone().applyQuaternion(relative).normalize();
        const desired = new Quaternion().setFromUnitVectors(normal, UP).multiply(current).normalize();
        foot.quaternion.copy(foot.parent.getWorldQuaternion(new Quaternion()).invert()).multiply(desired).normalize();
        const toeAngle = toe ? toe.quaternion.clone().normalize().angleTo(calibration.toeRestQuaternion.clone().normalize()) : 0;
        if (toe) toe.quaternion.copy(calibration.toeRestQuaternion);
        const point = foot.getWorldPosition(new Vector3());
        const sampledGround = groundAt(point.x, point.z, point.y + 0.22);
        const groundY = Number.isFinite(sampledGround) ? sampledGround : 0;
        feet[side] = {
          groundY, translationY: 0, limited: false,
          angleCorrectionDegrees: current.clone().normalize().angleTo(desired) * 180 / Math.PI,
          toeCorrectionDegrees: toeAngle * 180 / Math.PI,
          before: { heelY: before[side].heelY, toeY: before[side].toeY, soleMinY: before[side].soleMinY },
        };
      }
      actor.refresh();

      // Flattening changes sole height. Correct each ankle independently rather
      // than lifting both legs by whichever shoe is lower. Measure real skinned
      // vertices again so mixed skin weights cannot leave a residual silently.
      let measured = actor.measureFeet();
      for (let iteration = 0; iteration < 3; iteration++) {
        let changed = false;
        for (const side of ['left', 'right']) {
          const status = feet[side], desiredShift = status.groundY - measured[side].soleMinY;
          const remainingLow = -limit - status.translationY, remainingHigh = limit - status.translationY;
          const shift = Math.max(remainingLow, Math.min(remainingHigh, desiredShift));
          status.limited ||= Math.abs(shift - desiredShift) > 1e-7;
          if (Math.abs(shift) <= 1e-8) continue;
          const foot = actor.bones.get(side + 'foot'), point = foot.getWorldPosition(new Vector3());
          point.y += shift; foot.position.copy(foot.parent.worldToLocal(point));
          status.translationY += shift; changed = true;
        }
        if (!changed) break;
        actor.refresh(); measured = actor.measureFeet();
      }
      for (const side of ['left', 'right']) {
        const status = feet[side], values = measured[side];
        status.after = { heelY: values.heelY, toeY: values.toeY, soleMinY: values.soleMinY,
          heelResidual: values.heelY - status.groundY, toeResidual: values.toeY - status.groundY,
          pitchDegrees: values.pitchDeg, rollDegrees: values.rollDeg };
      }
      return (lastStatus = { active: true, reason: 'static_support', clip: selected, feet });
    },
    reset() { lastStatus = { active: false, reason: 'reset', feet: {} }; },
    getStatus() { return lastStatus; },
  };
}
