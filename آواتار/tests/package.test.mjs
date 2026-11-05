import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseGLB } from '../scripts/glb.mjs';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const manifest=await json('../al-amr.plugin.json'),pkg=await json('../package.json');
test('release has one matching version and every declared frontend export exists in the built entry',async()=>{
  assert.equal(pkg.version,'0.1.3');assert.equal(manifest.version,pkg.version);
  const lock=await json('../package-lock.json');assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[''].name,pkg.name);assert.equal(lock.packages[''].version,pkg.version);
  const exports=await import('../dist/index.js');
  for(const adapter of manifest.frontendAdapters)for(const name of adapter.exports)assert.ok(name in exports,name);
  for(const value of Object.values(pkg.exports)){
    if(typeof value==='string'){if(!value.includes('*'))await access(new URL('../'+value,import.meta.url));}
    else for(const file of Object.values(value))await access(new URL('../'+file,import.meta.url));
  }
  assert.equal(typeof exports.AvatarWebV2,'object');assert.equal(typeof exports.Avatar03,'object');
  assert.equal(exports.AVATAR03_CLIPS.length,9);assert.equal(exports.AVATAR_V2_HEIGHT,1.78);
  await access(new URL(exports.AVATAR_V2_MODEL_URL));await access(new URL(exports.AVATAR_V2_MOTIONS_URL));
});
test('packaged web model keeps all data bytes and JSON semantics while removing duplicate embedded images',async()=>{
  const original=parseGLB(await readFile(new URL('../assets-source/web-v2/avatar.glb',import.meta.url)));
  const root=new URL('../dist/assets/avatar-v2/',import.meta.url);
  const exported=JSON.parse(await readFile(new URL('avatar.gltf',root),'utf8'));
  const binary=await readFile(new URL('avatar.bin',root));
  const inventory=JSON.parse(await readFile(new URL('asset-manifest.json',root),'utf8'));
  assert.ok(binary.length<original.binary.length-2000000,'image-only views must not be shipped twice');
  const reverse=Object.fromEntries(Object.entries(inventory.bufferViewRemap).map(([a,b])=>[b,Number(a)]));
  for(const [oldIndex,newIndex] of Object.entries(inventory.bufferViewRemap)){
    const before=original.json.bufferViews[oldIndex],after=exported.bufferViews[newIndex];
    assert.deepEqual(binary.subarray(after.byteOffset??0,(after.byteOffset??0)+after.byteLength),original.binary.subarray(before.byteOffset??0,(before.byteOffset??0)+before.byteLength),'exact retained geometry/morph/skin/animation view '+oldIndex);
    assert.deepEqual({...after,byteOffset:before.byteOffset},{...before});
    assert.equal((after.byteOffset??0)%4,0);
  }
  for(const accessor of exported.accessors){
    if(accessor.bufferView!==undefined)accessor.bufferView=reverse[accessor.bufferView];
    if(accessor.sparse)for(const key of ['indices','values'])accessor.sparse[key].bufferView=reverse[accessor.sparse[key].bufferView];
  }
  assert.equal(exported.images.length,14);
  for(const [index,image] of original.json.images.entries()){
    const view=original.json.bufferViews[image.bufferView];
    assert.deepEqual(await readFile(new URL(exported.images[index].uri,root)),original.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
    delete exported.images[index].uri;exported.images[index].bufferView=image.bufferView;
  }
  exported.bufferViews=original.json.bufferViews;
  exported.buffers=original.json.buffers;
  assert.deepEqual(exported,original.json);
  for(const file of inventory.files){const bytes=await readFile(new URL(file.path,root));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);}
  assert.equal(inventory.jointCount,73);assert.equal(inventory.morphNames.length,66);
});
