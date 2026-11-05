import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {loadHybridAssets} from './load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';
const fixture=await loadHybridAssets();
const frame={pose:{position:[0,0,0],velocity:[0,0,0],yaw:0,mode:'grounded'},locomotion:{state:'idle',grounded:true,horizontalSpeed:0,verticalSpeed:0},camera:new PerspectiveCamera()};
const digits=['thumb','index','middle','ring','pinky'];
const fingerprint=root=>{const h=createHash('sha256');root.traverse(n=>{if(n.isMesh){h.update(Buffer.from(n.geometry.attributes.position.array.buffer));if(n.geometry.index)h.update(Buffer.from(n.geometry.index.array.buffer));}});return h.digest('hex');};
const step=(r,n=90)=>{for(let i=0;i<n;i++)r.update(1/60,frame);r.root.updateMatrixWorld(true);};
const point=(mesh,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);

test('private hand rigs have five real chains and normalized finite skin weights; cached assets survive disposal',async()=>{
  const before=[fingerprint(fixture.legacy.scene),fingerprint(fixture.web.scene)],r=await createHybridRuntime(fixture.legacy,fixture.web,fixture.motions);
  try{assert.equal(r.getStatus().morphCount,66);assert.equal(r.getStatus().mappingCount,41);
    const used=new Set();for(const h of Object.values(r.hands.hands)){
      assert.equal(h.joints.length,15);assert.equal(h.skeleton.bones.length,21);assert.equal(h.mesh.geometry.index.count/3,6828);
      for(const digit of digits)assert.equal(h.joints.filter(j=>j.digit===digit).length,3);
      for(const bone of h.skeleton.bones){assert.ok(!used.has(bone.uuid));used.add(bone.uuid);}
      const g=h.mesh.geometry;for(const a of Object.values(g.attributes))for(const x of a.array)assert.ok(Number.isFinite(x));
      for(let i=0;i<g.attributes.skinWeight.count;i++){let sum=0;for(let c=0;c<4;c++){const w=g.attributes.skinWeight.getComponent(i,c);assert.ok(w>=0&&w<=1);sum+=w;}assert.ok(Math.abs(sum-1)<1e-6);}
    }
  }finally{r.dispose();}
  assert.deepEqual([fingerprint(fixture.legacy.scene),fingerprint(fixture.web.scene)],before);
});

test('each of ten finger controls deforms its weighted mesh without moving the opposite hand',async()=>{
  const r=await createHybridRuntime(fixture.legacy,fixture.web,fixture.motions);
  try{r.previewClip('Stand');r.setPlayback({paused:true});r.seekClip(0);
    for(const side of ['left','right'])for(const digit of digits){
      r.setHandPose('open');step(r);const h=r.hands.hands[side],other=r.hands.hands[side==='left'?'right':'left'],g=h.mesh.geometry;
      const indices=new Set(h.joints.filter(j=>j.digit===digit).map(j=>h.skeleton.bones.indexOf(j.bone)));
      const candidates=[];for(let i=0;i<g.attributes.position.count;i++){let weight=0;for(let c=0;c<4;c++)if(indices.has(g.attributes.skinIndex.getComponent(i,c)))weight+=g.attributes.skinWeight.getComponent(i,c);if(weight>.8)candidates.push(i);}
      assert.ok(candidates.length>20,side+digit+' must own skinned vertices');
      const old=candidates.map(i=>point(h.mesh,i)),opposite=point(other.mesh,other.mesh.geometry.attributes.position.count-1);
      r.setFingerCurl(side,digit,.7);step(r);
      assert.ok(Math.max(...candidates.map((v,i)=>point(h.mesh,v).distanceTo(old[i])))>.005,side+digit+' must visibly deform');
      assert.ok(point(other.mesh,other.mesh.geometry.attributes.position.count-1).distanceTo(opposite)<1e-7,'other hand remains unchanged');
    }
  }finally{r.dispose();}
});

test('hand mounts remain attached and bounded in native stand, walk, run, seated and raised-hand clips',async()=>{
  const r=await createHybridRuntime(fixture.legacy,fixture.web,fixture.motions);
  try{for(const clip of ['Stand','Walk','Run','Sitting','HandRaise']){
    r.previewClip(clip);r.setPlayback({paused:true});r.seekClip(.25);step(r,2);
    for(const [side,h]of Object.entries(r.hands.hands)){
      assert.ok(h.mesh.getWorldPosition(new Vector3()).distanceTo(r.body.bones.get(side+'hand').getWorldPosition(new Vector3()))<1e-7,clip+side);
      const size=new Box3().setFromObject(h.mesh,true).getSize(new Vector3());assert.ok(size.length()>.05&&size.length()<.5,clip+side+' sensible physical hand bounds');
    }
  }}finally{r.dispose();}
});

test('open hand surface size matches the original open-hand reference symmetrically',async()=>{
  const r=await createHybridRuntime(fixture.legacy,fixture.web,fixture.motions),result={};
  try{
    r.previewClip('Stand');r.setPlayback({paused:true});r.seekClip(0);r.setHandPose('open');step(r);
    for(const [side,h]of Object.entries(r.hands.hands)){
      const wrist=r.body.bones.get(side+'hand').getWorldPosition(new Vector3()),distances=[];
      for(let i=0;i<h.mesh.geometry.attributes.position.count;i++)distances.push(point(h.mesh,i).distanceTo(wrist));
      distances.sort((a,b)=>a-b);const measured=distances[Math.floor((distances.length-1)*.98)];
      assert.ok(Math.abs(h.stats.referenceReachMeters-.19345058347)<.00001,'pinned original 1.78m body open-hand reference');
      assert.ok(Math.abs(measured-h.stats.referenceReachMeters)<.001,'actual skinned surface follows the requested physical scale');
      result[side]={referenceReachMeters:h.stats.referenceReachMeters,measuredOpenReachMeters:measured,calibration:h.stats.sizeCalibration,scale:h.stats.scale};
    }
    assert.ok(Math.abs(result.left.measuredOpenReachMeters-result.right.measuredOpenReachMeters)<.001);
    await writeFile(new URL('../../docs/runs/avatar-hands-2026-11-03/hand-size-verification.json',import.meta.url),JSON.stringify(result,null,2));
  }finally{r.dispose();}
});
