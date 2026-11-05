// Local verification, using decoded pixels of the unchanged authored PNG.
// Decode to .local/neckline-soft-fit/atlas.rgba before running; never shipped.
import {readFile,writeFile} from 'node:fs/promises';
import {DataTexture,Matrix4,Quaternion,Vector3,Triangle,Ray} from 'three';
import {loadHybridAssets} from '../tests/load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';

const V=()=>new Vector3(),assets=await loadHybridAssets();
const pixels=new Uint8Array(await readFile(new URL('../../.local/neckline-soft-fit/atlas.rgba',import.meta.url)));
const size=Math.sqrt(pixels.length/4),map=new DataTexture(pixels,size,size);map.flipY=false;
assets.legacy.scene.traverse(n=>{if(n.isMesh)n.material.map=map;});
const purple=(u,v)=>{const k=(Math.min(size-1,Math.max(0,Math.floor(v*size)))*size+Math.min(size-1,Math.max(0,Math.floor(u*size))))*4;
  const [r,g,b]=pixels.subarray(k,k+3);return b>g*1.12&&r>g*1.04&&b>r*.92;};
const frame=r=>new Matrix4().compose(r.body.bones.get('head').getWorldPosition(V()),r.body.bones.get('head').getWorldQuaternion(new Quaternion()),V().setScalar(1));
function triangles(mesh,f){
  mesh.skeleton.update();const into=f.clone().invert(),g=mesh.geometry,points=Array.from({length:g.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(into));
  const result=[];for(let j=0;j<g.index.count;j+=3){const ids=[0,1,2].map(i=>g.index.getX(j+i)),p=ids.map(i=>points[i]);
    if(Math.min(...p.map(p=>p.y))>-.005||Math.max(...p.map(p=>p.y))<-.16)continue;
    result.push({triangle:new Triangle(...p),ids});}
  return {result,g};
}
function profile(r){
  const f=frame(r),body=triangles(r.body.meshes[0],f),head=triangles(r.face.bindings.find(b=>b.node.name==='AvatarHead').node,f);
  const ray=new Ray(),hit=V(),bary=V();const rows=[];
  for(let degrees=0;degrees<360;degrees+=30){
    const angle=degrees*Math.PI/180;ray.direction.set(Math.sin(angle),0,Math.cos(angle));
    const candidates=[];
    for(let y=-.020;y>=-.140;y-=.001){
      ray.origin.set(0,y,.005);let clothRadius=Infinity,skinRadius=Infinity;
      for(const {triangle,ids} of body.result){
        if(!ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))continue;
        triangle.getBarycoord(hit,bary);
        const uv=body.g.attributes.uv;
        const u=ids.reduce((sum,id,c)=>sum+uv.getX(id)*bary.getComponent(c),0),v=ids.reduce((sum,id,c)=>sum+uv.getY(id)*bary.getComponent(c),0);
        if(purple(u,v))clothRadius=Math.min(clothRadius,hit.distanceTo(ray.origin));
      }
      if(!Number.isFinite(clothRadius))continue;
      for(const {triangle} of head.result)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))skinRadius=Math.min(skinRadius,hit.distanceTo(ray.origin));
      if(Number.isFinite(skinRadius))candidates.push({yMm:y*1000,clothRadiusMm:clothRadius*1000,skinRadiusMm:skinRadius*1000,gapMm:(clothRadius-skinRadius)*1000});
      if(candidates.length===3)break;
    }
    rows.push({degrees,edge:candidates});
  }
  return rows;
}
const a=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{garmentNeckline:false,detailedHands:false});
const b=await createHybridRuntime(assets.legacy,assets.web,assets.motions,{detailedHands:false});
try{
  const report={method:'12 radial rays, 1mm vertical steps, first 3 visible purple-texel intersections; signed gap to unchanged neck',before:profile(a),after:profile(b)};
  await writeFile(new URL('../../docs/runs/avatar-neckline-soft-fit-2026-11-05/clearance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(report.before.map((r,i)=>({degrees:r.degrees,before:r.edge[0]?.gapMm,after:report.after[i].edge[0]?.gapMm})));
}finally{a.dispose();b.dispose();map.dispose();}
