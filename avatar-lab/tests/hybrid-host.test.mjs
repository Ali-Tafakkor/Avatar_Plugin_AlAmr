import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HYBRID_MOVEMENT_PROFILES, isComparisonLocomotionKey, resumeComparisonLocomotion } from '../src/hybrid-comparison.mjs';
import { parseLegacyGlb, prepareHybridAssets } from '../scripts/prepare-avatar-hybrid.mjs';

const packageName = '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';

test('production hybrid physics retain V1 walk/run and the accepted V2 jump', () => {
  assert.equal(HYBRID_MOVEMENT_PROFILES.v2.walkSpeed, 5);
  assert.equal(HYBRID_MOVEMENT_PROFILES.v2.sprintSpeed, 9);
  assert.equal(HYBRID_MOVEMENT_PROFILES.v2.jumpSpeed, 5.6);
  assert.equal(HYBRID_MOVEMENT_PROFILES.v2.gravity, 18.8);
});

test('jump and official WASD, Space and flight keys resume V2 locomotion after Sitting or HandRaise preview', async () => {
  for (const clip of ['Sitting', 'HandRaise']) {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'Space', 'KeyF', 'ShiftLeft', 'ControlLeft']) {
      const state = { legacy: clip, hybrid: clip, paused: true, timeScale: 0.25 };
      assert.equal(isComparisonLocomotionKey(code), true, code);
      if (isComparisonLocomotionKey(code)) {
        resumeComparisonLocomotion({ previewClip: value => { state.legacy = value; } }, {
          previewClip: value => { state.hybrid = value; },
          setPlayback: value => { Object.assign(state, value); },
        });
      }
      assert.equal(state.legacy, null); assert.equal(state.hybrid, null);
      assert.equal(state.paused, false); assert.equal(state.timeScale, 1);
    }
  }
  for (const code of ['KeyE', 'KeyB', 'Digit1']) assert.equal(isComparisonLocomotionKey(code), false, code);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /function jump\(\) \{ normalControl\(\);/);
  assert.match(app, /isComparisonLocomotionKey\(event.code\)\) normalControl\(\)/);
  assert.doesNotThrow(() => resumeComparisonLocomotion(null, null));
});

test('production host consumes the public Plugin adapter in one existing Player Rig scene', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../src/HybridComparisonAvatar.tsx', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.equal((app.match(/<PlayerRig\s/g) ?? []).length, 1);
  assert.equal((app.match(/<Canvas\s/g) ?? []).length, 1);
  assert.ok(app.includes('<LegacyComparisonAvatar') && app.includes('<HybridComparisonAvatar'));
  assert.ok(adapter.includes('AvatarHybrid as HybridComparisonAvatar') && adapter.includes(packageName));
  assert.ok(!/experiments|HybridTestAvatar|آواتار\//.test(app + adapter));
  assert.ok(entry.includes('<HybridApp/>'));
  assert.ok(app.includes("useState<EmotionName>('neutral')"));
});

test('installed-package preparation preserves the exact accepted V1 binary, skin/animation JSON and local V2 resources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'avatar-hybrid-host-'));
  try {
    const manifest = await prepareHybridAssets({ publicRoot: directory });
    const sourceBytes = await readFile(fileURLToPath(import.meta.resolve(packageName + '/model')));
    const { json, binary } = parseLegacyGlb(sourceBytes);
    const extracted = JSON.parse(await readFile(join(directory, 'avatar-hybrid/legacy.gltf'), 'utf8'));
    const normalized = structuredClone(extracted); delete normalized.buffers[0].uri;
    for (let i = 0; i < normalized.images.length; i++) {
      delete normalized.images[i].uri; normalized.images[i].bufferView = json.images[i].bufferView;
      const view = json.bufferViews[json.images[i].bufferView];
      assert.deepEqual(await readFile(join(directory, 'avatar-hybrid', extracted.images[i].uri)),
        binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    }
    assert.deepEqual(normalized, json, 'all skins, clips, nodes, meshes and UV accessors stay byte-value identical');
    assert.deepEqual(await readFile(join(directory, 'avatar-hybrid/legacy.bin')), binary);
    assert.equal(manifest.legacyBinarySha256, 'a94ee13b1e8667d26e2b4c5d431d699469fa24cd03a3bc2d320090a633d73c36',
      'the original V1 binary is the same accepted source, without requiring an experiment directory');
    const modelUrl = import.meta.resolve(packageName + '/web-model');
    assert.deepEqual(await readFile(join(directory, 'avatar-v2/avatar.gltf')), await readFile(fileURLToPath(modelUrl)));
    const web = JSON.parse(await readFile(join(directory, 'avatar-v2/avatar.gltf'), 'utf8'));
    for (const item of [...web.buffers, ...web.images]) {
      if (!item.uri || item.uri.startsWith('data:')) continue;
      assert.deepEqual(await readFile(join(directory, 'avatar-v2', item.uri)), await readFile(fileURLToPath(new URL(item.uri, modelUrl))));
    }
    assert.equal(manifest.legacyGeometryAndAnimationChanged, false);
  } finally {
    const resolved = join(tmpdir(), directory.slice(tmpdir().length));
    assert.equal(resolved, directory); assert.ok(directory.startsWith(join(tmpdir(), 'avatar-hybrid-host-')));
    await rm(directory, { recursive: true, force: true });
  }
});
