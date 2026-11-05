import test from 'node:test';
import assert from 'node:assert/strict';
import {Euler,Quaternion,Vector3} from 'three';
import {loadHybridAssets} from './load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';
import {writeFile} from 'node:fs/promises';

const assets=await loadHybridAssets();
const span=a=>Math.max(...a)-Math.min(...a);
function measure(r){
  r.previewClip('Stand');r.setPlayback({paused:true});r.seekClip(0);
  const head=r.body.bones.get('head'),q0=head.getWorldQuaternion(new Quaternion()),duration=r.body.clips.get('Stand').duration;
  const angles=[[],[],[]],vertical=[],depth=[],chest=[];
  for(let i=0;i<=144;i++){
    r.seekClip(duration*i/144);
    const e=new Euler().setFromQuaternion(q0.clone().invert().multiply(head.getWorldQuaternion(new Quaternion())),'YXZ');
    [e.x,e.y,e.z].forEach((x,j)=>angles[j].push(x*180/Math.PI));
    const p=head.getWorldPosition(new Vector3());vertical.push(p.y);depth.push(p.z);chest.push(r.body.bones.get('spine2').scale.x);
  }
  return {duration,pitchYawRollPeakToPeakDegrees:angles.map(span),headVerticalPeakToPeakMm:span(vertical)*1000,
    headDepthPeakToPeakMm:span(depth)*1000,chestWidthScaleRange:span(chest)};
}
test('quiet Stand removes the original head bob and look-around while retaining tiny breathing and native other clips',async()=>{
  const original=assets.legacy.animations.find(c=>c.name==='Stand');
  const bytes=original.tracks.map(t=>[Array.from(t.times),Array.from(t.values)]);
  const old=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{quietIdle:false,headOffset:[0,.060,-.012],handContact:false});
  const quiet=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{handContact:false});
  try{
    const before=measure(old),after=measure(quiet);
    assert.ok(before.pitchYawRollPeakToPeakDegrees[0]>20&&before.pitchYawRollPeakToPeakDegrees[1]>20);
    assert.ok(after.pitchYawRollPeakToPeakDegrees[0]<.1&&after.pitchYawRollPeakToPeakDegrees[1]>2&&after.pitchYawRollPeakToPeakDegrees[1]<2.6);
    assert.ok(after.headVerticalPeakToPeakMm<.2&&after.headDepthPeakToPeakMm<.3);
    assert.ok(after.chestWidthScaleRange>.003&&after.chestWidthScaleRange<.004);
    for(const [name,clip] of quiet.body.clips)if(name!=='Stand')
      assert.equal(clip,assets.legacy.animations.find(c=>c.name===name),'only Stand is replaced');
    assert.deepEqual(original.tracks.map(t=>[Array.from(t.times),Array.from(t.values)]),bytes,'cached animation remains untouched');
    await writeFile(new URL('../../docs/runs/avatar-neck-idle-2026-11-05/idle-measurement.json',import.meta.url),JSON.stringify({before,after},null,2)+'\n');
  }finally{quiet.dispose();old.dispose();}
});

test('the expressive head is lowered 25 mm as one assembly and continues following the real neck',async()=>{
  const old=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{headOffset:[0,.060,-.012]});
  const shortened=await createHybridRuntime(assets.legacy,assets.web,assets.motions);
  const native=r=>r.face.bindings.find(b=>b.node.name==='AvatarHead').node.skeleton.bones.find(b=>b.name.toLowerCase().endsWith('head'));
  try{
    old.root.updateMatrixWorld(true);shortened.root.updateMatrixWorld(true);
    const a=native(old).getWorldPosition(new Vector3()),b=native(shortened).getWorldPosition(new Vector3());
    const offset=a.sub(b).applyQuaternion(shortened.body.bones.get('head').getWorldQuaternion(new Quaternion()).invert());
    assert.ok(Math.abs(offset.y-.025)<1e-6);
    assert.ok(Math.abs(offset.x)<1e-6&&Math.abs(offset.z)<1e-6);
    assert.equal(shortened.getStatus().morphCount,66);
    for(const [name,clip] of shortened.body.clips)for(const t of [0,clip.duration*.5,clip.duration*.97]){
      shortened.previewClip(name);shortened.seekClip(t);shortened.root.updateMatrixWorld(true);
      const head=native(shortened),matrix=head.matrixWorld;
      assert.ok(matrix.elements.every(Number.isFinite),name+' keeps a valid synchronized facial rig');
    }
  }finally{old.dispose();shortened.dispose();}
});
