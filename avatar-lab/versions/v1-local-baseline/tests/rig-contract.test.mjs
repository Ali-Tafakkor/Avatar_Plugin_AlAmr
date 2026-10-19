import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerController, createFlatNavigationSurface, stepPlayerMovement, isPlayerGrounded,
  createAvatarAnimationDriver, shouldRenderLocalAvatar } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { MOTION_CLIPS } from '@al-amr-community/replace-me--avatar03/motion';

test('exact installed Player Rig emits the shared states consumed by Avatar 03', () => {
  const player = createPlayerController({position:[0,0,0],yaw:0});
  const navigation = createFlatNavigationSurface(0);
  const driver = createAvatarAnimationDriver();
  let pose = player.getPoseSnapshot();
  const base = {forward:false,backward:false,left:false,right:false,sprint:false,ascend:false,descend:false,jumpRequested:false,toggleFlightRequested:false,cameraYaw:0};
  const step = (intent={},frames=1) => {
    let locomotion;
    for(let i=0;i<frames;i++) {
      pose=stepPlayerMovement({pose,intent:{...base,...intent},navigation,deltaSeconds:1/60});
      locomotion=driver.update(pose,1/60,isPlayerGrounded(pose,navigation));
    }
    return MOTION_CLIPS[locomotion.state];
  };
  assert.equal(step({},60),'Stand');
  assert.equal(step({forward:true},60),'Walk');
  assert.ok(pose.position[2]<-0.3,'yaw=0 moves along -Z, matching the model adapter');
  assert.equal(step({forward:true,sprint:true},60),'Run');
  assert.equal(step({jumpRequested:true}),'Jump');
  assert.ok(pose.position[1]>0);
  assert.equal(step({toggleFlightRequested:true}),'Fly');
});

test('official camera visibility supports hiding the complete custom avatar in first person', () => {
  const camera=createPlayerController().getCameraSnapshot();
  assert.equal(shouldRenderLocalAvatar({...camera,mode:'first-person',firstPersonBlend:1}),false);
  assert.equal(shouldRenderLocalAvatar({...camera,mode:'third-person',firstPersonBlend:0}),true);
});
