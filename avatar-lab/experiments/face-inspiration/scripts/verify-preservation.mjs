import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { DataTexture, PerspectiveCamera } from 'three';
import { createHybridRuntime } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03/hybrid-runtime';
import { loadHybridAssets } from '../../../../آواتار/tests/load-hybrid-assets.mjs';
import { applyMaterialStudy } from '../src/material-study.mjs';

function fingerprint(root) {
  const hash=createHash('sha256');
  root.traverse(node=>{
    if(!node.isMesh) return;
    hash.update(node.name);
    for(const attribute of [...Object.values(node.geometry.attributes),...Object.values(node.geometry.morphAttributes).flat(),...(node.geometry.index?[node.geometry.index]:[])]) {
      hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
    }
  });
  return hash.digest('hex');
}
const fixture=await loadHybridAssets();
const sourceBefore=[fingerprint(fixture.legacy.scene),fingerprint(fixture.web.scene)];
const reference=await createHybridRuntime(fixture.legacy,fixture.web,fixture.motions);
const candidate=await createHybridRuntime(fixture.legacy,fixture.web,fixture.motions);
const baselineBefore=fingerprint(reference.root), candidateBefore=fingerprint(candidate.root);
const referenceMaterials=reference.face.bindings.map(b=>b.node.material);
const albedo=new DataTexture(new Uint8Array([150,110,90,255]),1,1); albedo.needsUpdate=true;
const study=applyMaterialStudy(candidate,albedo);
const checks={};
try {
  assert.equal(fingerprint(candidate.root),candidateBefore); checks.candidateGeometrySkinUVAndMorphsUnchanged=true;
  assert.equal(fingerprint(reference.root),baselineBefore); checks.referenceGeometryUnchanged=true;
  reference.face.bindings.forEach((binding,index)=>assert.equal(binding.node.material,referenceMaterials[index]));
  checks.referenceMaterialsUnchanged=true;
  assert.equal(candidate.face.shapes.size,reference.face.shapes.size); checks.facialChannelsPreserved=candidate.face.shapes.size;
  const camera=new PerspectiveCamera(); camera.position.set(0,1.7,3);
  const frame={pose:{position:[0,0,0],velocity:[0,0,0],yaw:0,mode:'grounded'},locomotion:{state:'idle',grounded:true,horizontalSpeed:0,verticalSpeed:0},camera};
  const key={neutral:null,smile:'mouthSmileLeft',laugh:'jawOpen',sad:'mouthFrownLeft',angry:'browDownLeft',surprise:'jawOpen'};
  checks.emotions={};
  for(const [emotion,channel] of Object.entries(key)) {
    for(const runtime of [reference,candidate]) {runtime.setEmotion(emotion);runtime.setIntensity(.8);runtime.setFaceOptions({blinkEnabled:false,gazeEnabled:false,microEnabled:false});}
    for(let i=0;i<90;i++){reference.update(1/60,frame);candidate.update(1/60,frame);}
    const expected=reference.getStatus().weights, actual=candidate.getStatus().weights;
    for(const [name,value] of Object.entries(expected)) assert.ok(Math.abs((actual[name]??0)-value)<1e-8,emotion+':'+name);
    if(channel) assert.ok(actual[channel]>.02,emotion+' must deform the actual rig');
    const bindings=candidate.face.bindings.filter(b=>b.normalized===(channel??'jawOpen').toLowerCase());
    assert.ok(bindings.length); for(const b of bindings) assert.equal(b.node.morphTargetInfluences[b.index],actual[channel??'jawOpen']??0);
    checks.emotions[emotion]='same native deformation as reference';
  }
  candidate.blink(); for(let i=0;i<5;i++)candidate.update(1/60,frame);
  assert.ok(candidate.getStatus().weights.eyeBlinkLeft>.9); checks.realBlinkPreserved=true;
  checks.changedMeshes=study.changedMeshes;
} finally {study.dispose();reference.dispose();candidate.dispose();albedo.dispose();}
assert.deepEqual([fingerprint(fixture.legacy.scene),fingerprint(fixture.web.scene)],sourceBefore);
checks.cachedSourceAssetsUnchanged=true;
const output=new URL('../../../../docs/runs/face-inspiration-2026-11-03/',import.meta.url);
// From scripts/ up four levels reaches the workspace root.
await mkdir(output,{recursive:true});
await writeFile(new URL('preservation-tests.json',output),JSON.stringify({status:'passed',scope:'Actual native geometry, skin, morphs, source isolation and six emotion poses; rendered appearance is a separate check.',checks},null,2));
console.log(JSON.stringify({status:'passed',checks}));
