import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {Vector3,Box3} from 'three';
import {loadHybridAssets} from '../tests/load-hybrid-assets.mjs';
const f=await loadHybridAssets(), result={};
for(const [name,gltf] of [['legacy',f.legacy],['donor',f.web]]){
  gltf.scene.updateMatrixWorld(true);
  const bones=[],meshes=[];
  gltf.scene.traverse(n=>{
    if(n.isBone && /hand/i.test(n.name)) bones.push({name:n.name,parent:n.parent.name,p:n.getWorldPosition(new Vector3()).toArray()});
    if(!n.isMesh)return;
    const g=n.geometry, i=g.attributes.skinIndex,w=g.attributes.skinWeight;
    const counts={left:0,right:0}, boxes={left:new Box3(),right:new Box3()};
    if(i&&w)for(let v=0;v<g.attributes.position.count;v++)for(const side of ['left','right']){
      let total=0;for(let c=0;c<4;c++)if(new RegExp(side+'hand','i').test(n.skeleton.bones[i.getComponent(v,c)]?.name))total+=w.getComponent(v,c);
      if(total>.2){counts[side]++;boxes[side].expandByPoint(n.getVertexPosition(v,new Vector3()).applyMatrix4(n.matrixWorld));}
    }
    meshes.push({name:n.name,vertices:g.attributes.position.count,triangles:(g.index?.count??g.attributes.position.count)/3,material:n.material.name,handVertices:counts,handBounds:Object.fromEntries(Object.entries(boxes).map(([s,b])=>[s,{min:b.min.toArray(),max:b.max.toArray()}]))});
  });
  result[name]={handBones:bones,meshes};
}
const output=new URL('../../docs/runs/avatar-hands-2026-11-03/',import.meta.url);
await mkdir(output,{recursive:true});await writeFile(new URL('baseline-audit.json',output),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
