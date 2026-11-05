import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Group, NumberKeyframeTrack } from 'three';
import { Avatar03Animator, AVATAR03_CLIPS } from '../dist/motion.js';
const setup = () => {
  const root = new Group();
  const bone = new Group(); bone.name = 'testBone'; root.add(bone);
  const clips = AVATAR03_CLIPS.map(name => new AnimationClip(name, 1, [new NumberKeyframeTrack('testBone.position[y]', [0, 1], [0, 1])]));
  return { root, animator: new Avatar03Animator(root, clips) };
};
test('host motion selects real embedded clips without moving the host root', () => {
  const { root, animator } = setup();
  for (const [state, clip] of [['idle','Stand'],['walk','Walk'],['run','Run'],['jump','Jump'],['fly','Fly']]) {
    animator.setMotion({ state, horizontalSpeed: 2.4 }); animator.update(0.1);
    assert.equal(animator.getStatus().clip, clip);
  }
  assert.deepEqual(root.position.toArray(), [0,0,0]); animator.dispose();
});
test('fall continues jump and land returns to idle with explicit fallback status', () => {
  const { animator } = setup();
  animator.setMotion({state:'jump'}); animator.update(0.1);
  const time = animator.getStatus().time;
  animator.setMotion({state:'fall'});
  assert.equal(animator.getStatus().time, time); assert.equal(animator.getStatus().fallback, true);
  animator.setMotion({state:'land'}); assert.equal(animator.getStatus().clip,'Stand'); animator.dispose();
});
test('manual one-shot holds its final pose and auto mode restores latest host state', () => {
  const { animator } = setup(); animator.preview('StandToSit');
  animator.setMotion({state:'walk'});
  for(let i=0;i<30;i++) animator.update(0.1);
  assert.equal(animator.getStatus().clip,'StandToSit'); assert.equal(animator.getStatus().time,1);
  animator.preview(null); assert.equal(animator.getStatus().clip,'Walk'); animator.dispose();
});
test('missing source clips fail loudly and independent instances do not share animation time', () => {
  assert.throws(() => new Avatar03Animator(new Group(), []), /missing_clips/);
  const a=setup().animator, b=setup().animator;
  a.update(0.1); assert.equal(b.getStatus().time,0);
  a.dispose(); a.dispose(); a.update(0.1); b.dispose();
});
