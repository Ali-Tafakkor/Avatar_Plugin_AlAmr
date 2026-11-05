import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { createHybridRuntime } from '../dist/hybrid/runtime.mjs';
import { createHybridRuntime as createAcceptedHybrid } from '../../avatar-lab/experiments/hybrid-v2-face/runtime.mjs';
import { EMOTIONS } from '../dist/web-v2/runtime.mjs';
import { loadHybridAssets } from './load-hybrid-assets.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = await loadHybridAssets();
const originalGeometry = gltf => {
  const hash = createHash('sha256');
  gltf.scene.traverse(node => {
    if (node.isBone) hash.update(JSON.stringify([node.name, ...node.position, ...node.quaternion, ...node.scale]));
    if (!node.isMesh) return;
    hash.update(JSON.stringify((Array.isArray(node.material) ? node.material : [node.material])
      .map(material => [material.transparent, material.depthWrite, material.alphaTest])));
    const attributes = [...Object.entries(node.geometry.attributes),
      ...Object.entries(node.geometry.morphAttributes).flatMap(([name, values]) => values.map((value, index) => [name + index, value]))];
    if (node.geometry.index) attributes.push(['index', node.geometry.index]);
    for (const [name, value] of attributes) {
      hash.update(name); hash.update(Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength));
    }
  });
  return hash.digest('hex');
};
const cached = { legacy: originalGeometry(fixture.legacy), web: originalGeometry(fixture.web) };
const camera = new PerspectiveCamera(); camera.position.set(8, 4.8, -2);
const frame = (state = 'idle', grounded = true, y = 0, vy = 0, speed = 0) => ({
  pose: { position: [8, 3.2 + y, -7], velocity: [0, vy, -speed], yaw: 1.8, mode: state === 'fly' ? 'flying' : 'grounded' },
  locomotion: { state, grounded, horizontalSpeed: speed, verticalSpeed: vy }, camera,
});
const bodyPose = runtime => [...runtime.body.bones].map(([name, bone]) => [name, bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]);
const faceMeshes = runtime => [...new Set(runtime.face.bindings.map(binding => binding.node))];
function assertEquivalent(plugin, accepted) {
  assert.deepEqual(bodyPose(plugin), bodyPose(accepted));
  const a = plugin.getStatus(), b = accepted.getStatus();
  for (const name of ['state', 'clip', 'mode', 'time', 'duration', 'activeMotionSource', 'jumpWeight', 'morphCount', 'missingShapes', 'weights']) {
    assert.deepEqual(a[name], b[name], 'ported status ' + name);
  }
  assert.deepEqual(a.feet, b.feet); assert.deepEqual(a.knees, b.knees);
  const targets = new Map(faceMeshes(accepted).map(mesh => [mesh.name, mesh]));
  for (const mesh of faceMeshes(plugin)) {
    const reference = targets.get(mesh.name); assert.ok(reference, mesh.name);
    assert.deepEqual(mesh.morphTargetInfluences, reference.morphTargetInfluences);
    const indices = [...new Set(mesh.geometry.index?.array ?? Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => index))];
    // Include both extremes and deterministic interior samples of every native
    // face mesh, including the lower-neck boundary, eyeballs and lower teeth.
    for (let i = 0; i < indices.length; i += Math.max(1, Math.floor(indices.length / 48))) {
      const index = indices[i], actual = mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld);
      const expected = reference.getVertexPosition(index, new Vector3()).applyMatrix4(reference.matrixWorld);
      assert.ok(actual.distanceTo(expected) < 1e-6, mesh.name + ' visible surface drift');
    }
  }
}

test('repository acceptance fingerprints match the frozen production migration', async () => {
  const provenance = JSON.parse(await fs.readFile(new URL('../dist/hybrid/accepted-source.json', import.meta.url), 'utf8'));
  assert.equal(provenance.files.filter(file=>file.acceptedSourceSha256).length,5,'all five historical references remain pinned');
  for (const file of provenance.files.filter(file=>file.acceptedSourceSha256)) {
    const accepted = file.file === 'legacy-materials.mjs' ? '../../avatar-lab/src/legacy-preview.mjs'
      : '../../avatar-lab/experiments/hybrid-v2-face/' + file.file;
    assert.equal(sha(await fs.readFile(new URL(accepted, import.meta.url))), file.acceptedSourceSha256, file.file);
  }
  const added=provenance.files.filter(file=>!file.acceptedSourceSha256);
  assert.deepEqual(added.map(file=>file.file).sort(),['detailed-hands.mjs','garment-neckline.mjs','hand-contact.mjs','hand-skin-mask.mjs','neck-collar.mjs','quiet-idle.mjs','surface-materials.mjs']);
  for(const file of added)assert.equal(sha(await fs.readFile(new URL('../src/hybrid/'+file.file,import.meta.url))),file.packageLocalSha256,file.file);
});

test('built hybrid matches the accepted body, dynamic neck, face and V2 jump under transformed host playback', async () => {
  const options = { groundAt: () => 3.2, handContact:false, friendlyFace:false, quietIdle:false,headOffset:[0,.060,-.012],neckContour:false,garmentNeckline:false };
  const plugin = await createHybridRuntime(fixture.legacy, fixture.web, fixture.motions, options);
  const accepted = await createAcceptedHybrid(fixture.legacy, fixture.web, fixture.motions, options);
  const hosts = [plugin, accepted].map(runtime => { const host = new Group(); host.position.set(8, 3.2, -7); host.rotation.y = 1.8; host.add(runtime.root); return host; });
  const advance = (delta, input = frame()) => {
    for (let i = 0; i < hosts.length; i++) { hosts[i].position.y = input.pose.position[1]; hosts[i].updateMatrixWorld(true); }
    plugin.update(delta, input); accepted.update(delta, input);
  };
  try {
    for (const runtime of [plugin, accepted]) runtime.setFaceOptions({ blinkEnabled: false, gazeEnabled: false, microEnabled: false });
    assert.equal(plugin.getStatus().morphCount, 66); assert.deepEqual(plugin.getStatus().missingShapes, []);
    assert.equal(plugin.body.bones.size, 41);
    for (const clip of plugin.getStatus().clips) {
      for (const fraction of [0, 0.37, 1]) {
        for (const runtime of [plugin, accepted]) { runtime.previewClip(clip.name); runtime.setPlayback({ paused: true }); runtime.seekClip(clip.duration * fraction); }
        advance(1 / 60); assertEquivalent(plugin, accepted);
      }
    }
    for (const runtime of [plugin, accepted]) { runtime.reset(); runtime.setPlayback({ paused: false, timeScale: 1 }); }
    for (const [state, speed] of [['walk', 5], ['run', 9]]) {
      for (let i = 0; i < 30; i++) advance(1 / 60, frame(state, true, 0, 0, speed));
      assertEquivalent(plugin, accepted);
    }
    for (let i = 0; i < 35; i++) {
      const t = (i + 1) / 60, vy = 5.6 - 18.8 * t, y = Math.max(0, 5.6 * t - 9.4 * t * t);
      advance(1 / 60, frame(vy > 0 ? 'jump' : 'fall', false, y, vy, 9));
      assert.equal(plugin.getStatus().activeMotionSource, 'V2-jump-retargeted-to-V1');
      if (i % 7 === 0) assertEquivalent(plugin, accepted);
    }
    for (let i = 0; i < 36; i++) advance(1 / 60);
    assert.equal(plugin.getStatus().jumpWeight, 0); assertEquivalent(plugin, accepted);
    for (const runtime of [plugin, accepted]) { runtime.previewClip('HandRaise'); runtime.setPlayback({ paused: true }); runtime.seekClip(1.5); runtime.setIntensity(1); }
    for (const emotion of Object.keys(EMOTIONS)) {
      plugin.setEmotion(emotion); accepted.setEmotion(emotion);
      for (let i = 0; i < 90; i++) advance(1 / 60);
      assertEquivalent(plugin, accepted);
    }
    for (const runtime of [plugin, accepted]) { runtime.setManual('jaw', 0.75); runtime.blink(); }
    advance(0.07); assert.ok(plugin.getStatus().weights.eyeBlinkLeft > 0.99); assertEquivalent(plugin, accepted);
  } finally { plugin.dispose(); accepted.dispose(); }
  assert.equal(originalGeometry(fixture.legacy), cached.legacy); assert.equal(originalGeometry(fixture.web), cached.web);
});
