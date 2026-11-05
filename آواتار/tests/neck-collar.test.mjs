import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createHybridRuntime as createReference} from '../../avatar-lab/experiments/hybrid-v2-face/runtime.mjs';
import {Matrix4,Quaternion,Ray,Triangle,Vector3} from 'three';
import {loadHybridAssets} from './load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';

const V=()=>new Vector3(),assets=await loadHybridAssets();
const skin=r=>r.face.bindings.find(b=>b.node.name==='AvatarHead').node;
const frame=r=>new Matrix4().compose(r.body.bones.get('head').getWorldPosition(V()),
  r.body.bones.get('head').getWorldQuaternion(new Quaternion()),V().setScalar(1));
function surface(mesh,f){
  mesh.skeleton.update();const into=f.clone().invert(),g=mesh.geometry;
  const points=Array.from({length:g.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(into));
  const ids=g.index.array,triangles=[];
  for(let i=0;i<ids.length;i+=3){const p=[points[ids[i]],points[ids[i+1]],points[ids[i+2]]];
    if(Math.min(...p.map(v=>v.y))<.005)triangles.push(new Triangle(...p));}
  return {points,triangles};
}
function profiles(r){
  const {triangles}=surface(skin(r),frame(r)),ray=new Ray(),hit=V(),curves=[];
  for(const degrees of [60,90,120,240,270,300]){
    const a=degrees*Math.PI/180,values=[];ray.direction.set(Math.sin(a),0,Math.cos(a));
    for(let y=-.065;y<=-.022;y+=.002){
      ray.origin.set(0,y,.010);let distance=Infinity;
      for(const t of triangles)if(ray.intersectTriangle(t.a,t.b,t.c,false,hit))distance=Math.min(distance,hit.distanceTo(ray.origin));
      assert.ok(Number.isFinite(distance));values.push(distance);
    }
    const bends=values.slice(1,-1).map((v,i)=>Math.abs(values[i]+values[i+2]-2*v)*1000);
    curves.push({degrees,maxSecondDifferenceMm:Math.max(...bends),radiiMm:values.map(v=>v*1000)});
  }
  return curves;
}
test('actual neck side profiles lose the under-ear kink without changing the face or its 66 channels',async()=>{
  const a=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{neckContour:false,garmentNeckline:false,detailedHands:false});
  const b=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{detailedHands:false});
  try{
    const before=profiles(a),after=profiles(b);
    const total=rows=>rows.reduce((s,c)=>s+c.maxSecondDifferenceMm,0);
    assert.ok(total(after)<total(before)*.6,'measured side-profile bends must drop substantially');
    assert.ok(Math.max(...after.map(c=>c.maxSecondDifferenceMm))<.7,'no sharp new under-ear step');
    const original=skin(a).geometry,changed=skin(b).geometry,points=surface(skin(a),frame(a)).points;
    let protectedVertices=0;
    for(let i=0;i<points.length;i++)if(points[i].y>=0){
      protectedVertices++;
      for(let c=0;c<3;c++)assert.equal(changed.attributes.position.getComponent(i,c),original.attributes.position.getComponent(i,c));
    }
    assert.ok(protectedVertices>1000);assert.equal(b.face.shapes.size,66);
    for(const morph of [...changed.morphAttributes.position,...changed.morphAttributes.normal])
      assert.ok(morph.array.every(Number.isFinite));
    assert.equal(changed.attributes.position.count,original.attributes.position.count);
    assert.deepEqual(changed.index.array,original.index.array);
    await writeFile(new URL('../../docs/runs/avatar-cloth-restore-2026-11-05/neck-profiles.json',import.meta.url),JSON.stringify({before,after},null,2)+'\n');
  }finally{a.dispose();b.dispose();}
});

test('garment restoration matches the frozen body geometry and the accepted pre-collar cloth material',async()=>{
  const options={detailedHands:false,handContact:false,quietIdle:false,clothDetail:false,garmentNeckline:false};
  const current=await createHybridRuntime(assets.legacy,assets.web,assets.motions,options);
  const reference=await createReference(assets.legacy,assets.web,assets.motions,options);
  try{
    const a=current.body.meshes[0].geometry,b=reference.body.meshes[0].geometry;
    assert.deepEqual(Object.keys(a.attributes).sort(),Object.keys(b.attributes).sort());
    for(const name of Object.keys(a.attributes))assert.deepEqual(a.attributes[name].array,b.attributes[name].array,name+' restored without collar deformation');
    assert.deepEqual(a.index.array,b.index.array,'the original garment index mask is restored');
    assert.equal(current.body.meshes.length,1,'no replacement collar mesh remains');
    assert.equal(current.body.meshes[0].skeleton.bones.length,41);
    const bytes=await readFile(new URL('../dist/hybrid/surface-materials.mjs',import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),'daa2208dbb79ac91499e6b82f5eacce589a6e76018203740bbf906f62fb2dec1','accepted pre-collar cloth material restored exactly');
    assert.equal(a.attributes.hybridCollarRepair,undefined);assert.equal(a.attributes.hybridCollarClip,undefined);
  }finally{current.dispose();reference.dispose();}
});
