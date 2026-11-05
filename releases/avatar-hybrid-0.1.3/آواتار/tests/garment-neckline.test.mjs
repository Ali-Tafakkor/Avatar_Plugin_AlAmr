import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { createHybridRuntime } from '../dist/hybrid/runtime.mjs';
import { loadHybridAssets } from './load-hybrid-assets.mjs';

const assets = await loadHybridAssets();
const V = () => new Vector3();
const geometryBytes = geometry => [...Object.entries(geometry.attributes),
  ...Object.entries(geometry.morphAttributes).flatMap(([k,values])=>values.map((v,i)=>[k+i,v]))]
  .map(([k,v])=>[k,Buffer.from(v.array.buffer,v.array.byteOffset,v.array.byteLength).toString('base64')]);

test('neckline edit preserves every face/neck channel, texture coordinate, mask, triangle and rig weight',async()=>{
  const options={detailedHands:false,handContact:false};
  const before=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{...options,garmentNeckline:false});
  const after=await createHybridRuntime(assets.legacy,assets.web,assets.motions,options);
  try {
    const a=before.body.meshes[0],b=after.body.meshes[0],ga=a.geometry,gb=b.geometry;
    assert.deepEqual(Object.keys(gb.attributes),Object.keys(ga.attributes));
    for(const name of Object.keys(ga.attributes))if(!['position','normal'].includes(name))
      assert.deepEqual(gb.attributes[name].array,ga.attributes[name].array,name+' stays byte-identical');
    assert.deepEqual(gb.index.array,ga.index.array);
    assert.equal(after.body.meshes.length,before.body.meshes.length);
    assert.deepEqual(b.skeleton.boneInverses,a.skeleton.boneInverses);
    for(const binding of before.face.bindings){
      const peer=after.face.bindings.find(t=>t.node.name===binding.node.name);
      assert.deepEqual(geometryBytes(peer.node.geometry),geometryBytes(binding.node.geometry),binding.node.name+' geometry including neck and morphs');
    }
    // Bind-space values are tiny in the legacy asset: measure the real metric
    // skinned surface, not raw mesh units. The chest, sleeves and lower body
    // must remain exact, and the localized warp must not flip any triangle.
    before.root.updateMatrixWorld(true);after.root.updateMatrixWorld(true);
    const h=before.body.bones.get('head');
    const into=new Matrix4().compose(h.getWorldPosition(V()),h.getWorldQuaternion(new Quaternion()),V().setScalar(1)).invert();
    const points=mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(into));
    const p=points(a),q=points(b);let changed=0,max=0,protectedCount=0,minNormalDot=1;
    for(let i=0;i<p.length;i++){
      const delta=p[i].distanceTo(q[i]);max=Math.max(max,delta);if(delta>1e-8)changed++;
      if(p[i].y<-.201||Math.hypot(p[i].x,p[i].z+.005)>.206){
        protectedCount++;assert.ok(delta<1e-8,'outside shoulder transition is unchanged');
      }
      assert.ok(q[i].toArray().every(Number.isFinite));
    }
    for(let i=0;i<ga.index.count;i+=3){
      const ids=[0,1,2].map(j=>ga.index.getX(i+j));
      const n=points=>points[ids[1]].clone().sub(points[ids[0]]).cross(points[ids[2]].clone().sub(points[ids[0]]));
      const n0=n(p),n1=n(q);if(n0.lengthSq()<1e-18)continue;
      assert.ok(n1.lengthSq()>n0.lengthSq()*.20,'no collapsed triangles');
      const dot=n0.normalize().dot(n1.normalize());minNormalDot=Math.min(minNormalDot,dot);
      assert.ok(dot>.70,'no inverted or sharply folded triangles');
    }
    assert.ok(changed>100&&protectedCount>10000);assert.ok(max<.023);
    for(const [name,clip] of before.body.clips)for(const fraction of [0,.37,.8]){
      for(const r of [before,after]){r.previewClip(name);r.setPlayback({paused:true});r.seekClip(clip.duration*fraction);}
      assert.deepEqual([...after.body.bones].map(([name,b])=>[name,b.matrixWorld.elements]),[...before.body.bones].map(([name,b])=>[name,b.matrixWorld.elements]));
      for(const binding of before.face.bindings){
        const peer=after.face.bindings.find(t=>t.node.name===binding.node.name);
        assert.deepEqual(peer.node.matrixWorld.elements,binding.node.matrixWorld.elements);
        assert.deepEqual(peer.node.skeleton.bones.map(b=>b.matrixWorld.elements),binding.node.skeleton.bones.map(b=>b.matrixWorld.elements));
      }
    }
    console.log(JSON.stringify({changed,protectedCount,maxDisplacementMm:max*1000,minTriangleNormalDot:minNormalDot,neckAndFaceByteIdentical:true}));
  } finally {before.dispose();after.dispose();}
});
