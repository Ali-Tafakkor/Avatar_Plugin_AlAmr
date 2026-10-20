import fs from 'node:fs/promises';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { createMotionTestRuntime } from '../runtime.mjs';
import { loadMotionFixtures } from './model-fixtures.mjs';

// Actual skinned shoe samples and bone endpoints, independent of the correction
// modules' status values. This audit is local geometry evidence, not render proof.
const { web, legacy } = await loadMotionFixtures();
const motions = JSON.parse(await fs.readFile(new URL('../../../../آواتار/assets-source/web-v2/motions.json', import.meta.url), 'utf8'));
const candidate = await createMotionTestRuntime(web.gltf, motions, legacy.gltf);
const parent = new Group(); parent.position.set(1.25, 0, 0); parent.rotation.y = Math.PI; parent.add(candidate.root);
const camera = new PerspectiveCamera(); camera.position.set(0, 1.5, -5.8);
const frame = { pose: { position: [1.25, 0, 0], velocity: [0, 0, 0], yaw: 0, mode: 'grounded' },
  locomotion: { state: 'idle', grounded: true, verticalSpeed: 0, horizontalSpeed: 0 }, camera };
const position = name => candidate.actor.bones.get(name)?.getWorldPosition(new Vector3());
function hand(side) {
  const fingers = {};
  for (const digit of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
    const names = [1, 2, 3, 4].map(i => `${side}hand${digit}${i}`);
    const p = names.map(position); if (p.some(value => !value)) continue;
    const segments = p.slice(1).map((value, i) => value.clone().sub(p[i]));
    fingers[digit] = { pipFlexDeg: segments[0].angleTo(segments[1]) * 180 / Math.PI,
      dipFlexDeg: segments[1].angleTo(segments[2]) * 180 / Math.PI,
      reachRatio: p[0].distanceTo(p[3]) / segments.reduce((sum, value) => sum + value.length(), 0),
      tip: p[3].toArray() };
  }
  return fingers;
}
const samples = [];
try {
  for (const clip of ['Stand', 'Walk', 'Run', 'Sitting']) {
    candidate.previewClip(clip); candidate.setPlayback({ paused: true });
    const duration = candidate.getStatus().duration;
    for (const fraction of [0, 0.25, 0.5, 0.75, 0.9999]) {
      candidate.seekClip(duration * fraction); candidate.update(1 / 60, frame);
      const status = candidate.getStatus();
      samples.push({ clip, fraction, time: status.time, feet: candidate.actor.measureFeet(),
        hands: { left: hand('left'), right: hand('right') }, groundCorrection: status.groundCorrection,
        footContact: status.footContact ?? null, relaxedHands: status.relaxedHands ?? null });
    }
  }
  const result = { method: 'Skinned shoe heel/toe world heights and digit endpoint geometry', samples };
  if (process.argv[2]) await fs.writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ samples: samples.length, standing: samples.filter(value => value.clip === 'Stand')
    .map(({ fraction, feet }) => ({ fraction, leftHeel: feet.left.heelY, leftToe: feet.left.toeY,
      rightHeel: feet.right.heelY, rightToe: feet.right.toeY })) }, null, 2));
} finally { candidate.dispose(); }
