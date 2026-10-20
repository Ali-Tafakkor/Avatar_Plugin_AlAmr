import test from 'node:test';
import assert from 'node:assert/strict';
import { createActorInstance } from '../../../../آواتار/src/web-v2/actor.mjs';
import { retargetV1Clips } from '../retarget.mjs';
import { loadMotionFixtures } from './model-fixtures.mjs';
import { auditRetargetSamples } from './audit-sampling.mjs';
import { capturePose, NON_JUMP_V1_CLIPS } from './pose-metrics.mjs';

const { legacy, web } = await loadMotionFixtures();
const legacyBefore = capturePose({ root: legacy.gltf.scene });
const webBefore = capturePose({ root: web.gltf.scene });
const target = createActorInstance(web.gltf);
const retargeted = retargetV1Clips(target, legacy.gltf);
const report = await auditRetargetSamples({ retargeted, target, legacyGltf: legacy.gltf });

test.after(() => { retargeted.dispose(); target.dispose(); });

test('real retarget maps every common bone and all eight non-jump clips without malformed poses or time rewrites', () => {
  assert.equal(report.sourceBoneCount, 41);
  assert.equal(report.targetBoneCount, 73);
  assert.equal(report.commonBones.length, 41);
  assert.equal(report.includesLegacyJump, false);
  assert.deepEqual(report.clips.map(clip => clip.name), [...NON_JUMP_V1_CLIPS]);
  for (const clip of report.clips) {
    assert.equal(clip.durationError, 0, clip.name + ' original clip duration');
    assert.equal(clip.maxSampleTimeError, 0, clip.name + ' source sample time');
    assert.equal(clip.endpointSample.actual, clip.sourceDuration, clip.name + ' final frame must not wrap');
    assert.equal(clip.finite, true, clip.name + ' finite transforms');
    assert.deepEqual(clip.missing, [], clip.name + ' common segment coverage');
  }
});

test('independent body/finger directions stay within 0.001deg and palms within 0.05deg of V1', () => {
  // After the extra-neck-joint bridge correction, measured body directions
  // peak at 0.000131deg and finger directions at 0.000048deg. Palm planes peak
  // at 0.03002deg on sitting clips because the two rigs' thumb-base geometry
  // differs. The fixed wrist-to-thumb spread is reported separately, rather
  // than hidden by widening every angular tolerance.
  for (const clip of report.clips) {
    assert.ok(clip.maxBodyDegrees < 0.001, clip.name + ' body maximum: ' + clip.maxBodyDegrees);
    assert.ok(clip.maxPalmDegrees < 0.05, clip.name + ' palm maximum: ' + clip.maxPalmDegrees);
    assert.ok(clip.maxHipError < 1e-7, clip.name + ' root-relative hip motion: ' + clip.maxHipError);
    for (const frame of clip.frames) {
      assert.equal(frame.directions.degenerate.length, 0, clip.name + ' nondegenerate segments');
      for (const segment of frame.directions.segments.filter(value => /hand(?:thumb|index)[123]>/.test(value.name))) {
        assert.ok(segment.degrees < 0.001, clip.name + ' finger ' + segment.name + ': ' + segment.degrees);
      }
      const neck = frame.stretch.segments.find(segment => segment.name === 'neck>head');
      assert.ok(neck && neck.error < 1e-5, clip.name + ' bridged neck span stretch: ' + neck?.error);
    }
  }
});

test('sampling changes only actor instances and preserves both loaded source skeletons', () => {
  assert.deepEqual(capturePose({ root: legacy.gltf.scene }), legacyBefore);
  assert.deepEqual(capturePose({ root: web.gltf.scene }), webBefore);
});
