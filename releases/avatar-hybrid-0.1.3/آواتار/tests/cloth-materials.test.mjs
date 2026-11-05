import test from 'node:test';
import assert from 'node:assert/strict';
import {DataTexture,RGBAFormat,UnsignedByteType} from 'three';
import {loadHybridAssets} from './load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';
import {applyClothMaterials} from '../dist/hybrid/surface-materials.mjs';

test('clothing preserves real body topology and cached assets; owned resources release exactly once',async()=>{
  const f=await loadHybridAssets(); let source;
  f.legacy.scene.traverse(n=>{if(n.isMesh)source=n;});
  const map=new DataTexture(new Uint8Array([160,110,210,255]),1,1,RGBAFormat,UnsignedByteType);
  source.material.map=map;
  let sourceDisposed=0; map.addEventListener('dispose',()=>sourceDisposed++);
  const originalMaterial=source.material,originalGeometry=source.geometry;
  const originalPositions=originalGeometry.attributes.position.array.slice();
  const enhanced=await createHybridRuntime(f.legacy,f.web,f.motions);
  const baseline=await createHybridRuntime(f.legacy,f.web,f.motions,{clothDetail:false});
  let detailDisposed=0,materialDisposed=0;
  try {
    const a=enhanced.body.meshes[0],b=baseline.body.meshes[0],detail=a.material.normalMap;
    assert.deepEqual(a.geometry.index.array,b.geometry.index.array);
    assert.deepEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);
    assert.deepEqual(Object.keys(a.geometry.attributes),Object.keys(b.geometry.attributes));
    assert.deepEqual(a.skeleton.bones.map(n=>n.name),b.skeleton.bones.map(n=>n.name));
    assert.equal(enhanced.face.shapes.size,baseline.face.shapes.size);
    assert.equal(a.material.map,map); assert.equal(b.material.map,map);
    assert.ok(detail?.isDataTexture); assert.ok(detail.image.data.byteLength<=65536);
    assert.ok(a.material.opacityNode?.isNode,'clothing must retain the live collar cutout');
    const collarNode=b.material.opacityNode;
    const study=applyClothMaterials(baseline.body);
    try{assert.equal(b.material.opacityNode,collarNode,'the actual collar graph survives a material upgrade');}
    finally{study.dispose();}
    assert.equal(source.material,originalMaterial); assert.equal(source.geometry,originalGeometry);
    assert.deepEqual(source.geometry.attributes.position.array,originalPositions);
    detail.addEventListener('dispose',()=>detailDisposed++);
    a.material.addEventListener('dispose',()=>materialDisposed++);
    enhanced.dispose(); enhanced.dispose();
    assert.equal(detailDisposed,1); assert.equal(materialDisposed,1);
    assert.equal(sourceDisposed,0,'shared albedo must survive instance cleanup');
    assert.equal(b.material.map,map,'the other mounted instance remains usable');
  } finally {enhanced.dispose();baseline.dispose();map.dispose();}
});
