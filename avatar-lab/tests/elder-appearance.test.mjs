import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {DataTexture,PerspectiveCamera,Vector3} from 'three';
import {createHybridRuntime} from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import {loadHybridAssets} from '../../آواتار/tests/load-hybrid-assets.mjs';
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier==='three'||specifier.startsWith('three/'))return next(specifier,{...context,parentURL:import.meta.url});
  return next(specifier,context);
}});
const {applyElderAppearance}=await import('../../avatar-elder-man/appearance.mjs');
hook.deregister();
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');

test('elder sculpt preserves donor, live morphs, finite scalp normals and attached glasses',async t=>{
  const {legacy,web,motions}=await loadHybridAssets();
  const source=web.scene.getObjectByName('AvatarHead').geometry;
  const before=hash(source.attributes.position.array);
  const texture=new DataTexture(new Uint8Array([180,130,105,255]),1,1);texture.needsUpdate=true;
  const runtime=await createHybridRuntime(legacy,web,motions,{faceAlbedo:texture});
  t.after(()=>{runtime.dispose();texture.dispose();});
  const head=runtime.face.bindings.find(b=>b.node.name==='AvatarHead').node;
  const oldGeometry=head.geometry;
  const dispose=applyElderAppearance(runtime,texture);
  assert.ok(head.geometry.attributes.position.count>oldGeometry.attributes.position.count);
  assert.equal(hash(source.attributes.position.array),before);
  assert.equal(head.geometry.morphAttributes.position.length,oldGeometry.morphAttributes.position.length);
  for(const a of [head.geometry.attributes.position,head.geometry.attributes.normal,...head.geometry.morphAttributes.position,...head.geometry.morphAttributes.normal])assert.ok(a.array.every(Number.isFinite));
  const n=new Vector3();for(let i=0;i<head.geometry.attributes.normal.count;i++){n.fromBufferAttribute(head.geometry.attributes.normal,i);assert.ok(n.length()>.98&&n.length()<1.02,'scalp normals remain valid after warp');}
  const frame={pose:{position:[0,0,0],velocity:[0,0,0],yaw:0,mode:'grounded'},locomotion:{state:'idle',grounded:true,horizontalSpeed:0,verticalSpeed:0},camera:new PerspectiveCamera()};
  const glasses=runtime.root.getObjectByName('ElderGlasses');assert.ok(glasses);
  const bind=glasses.matrix.clone();
  for(const clip of ['Stand','Walk','Run','Sitting']){
    runtime.previewClip(clip);runtime.seekClip(.4);runtime.setEmotion('laugh');runtime.setIntensity(1);
    for(let i=0;i<30;i++)runtime.update(1/60,frame);
    assert.ok(runtime.getStatus().weights.jawOpen>.1);
    assert.deepEqual(glasses.matrix.elements,bind.elements);
    assert.ok(glasses.getWorldPosition(n).toArray().every(Number.isFinite));
  }
  dispose();assert.equal(head.geometry,oldGeometry);assert.equal(runtime.root.getObjectByName('ElderGlasses'),undefined);
  assert.equal(hash(source.attributes.position.array),before);
});
