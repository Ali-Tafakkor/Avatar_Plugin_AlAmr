// Offline verification against actual skinned garment triangles. The lab's
// existing BVH dependency is used only by this audit, never by the Plugin.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {BufferGeometry,DoubleSide,Float32BufferAttribute,Group,PerspectiveCamera,Ray,Vector3} from 'three';
import {loadHybridAssets} from '../tests/load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';

const require=createRequire(new URL('../../avatar-lab/package.json',import.meta.url));
const {MeshBVH}=require('three-mesh-bvh');
const assets=await loadHybridAssets(), runtime=await createHybridRuntime(assets.legacy,assets.web,assets.motions);
const mesh=runtime.body.meshes.find(m=>m.isSkinnedMesh), source=mesh.geometry;
const {position,skinWeight,skinIndex}=source.attributes;
const names=mesh.skeleton.bones.map(b=>b.name.toLowerCase());
const torsoOrLeg=new Uint8Array(position.count), used=new Set(), triangles=[];
for(let i=0;i<position.count;i++){
  let weight=0;
  for(let c=0;c<4;c++)if(!/arm|hand|shoulder/.test(names[skinIndex.getComponent(i,c)]))weight+=skinWeight.getComponent(i,c);
  torsoOrLeg[i]=weight>.8;
}
for(let i=0;i<source.index.count;i+=3){
  const a=source.index.getX(i), b=source.index.getX(i+1), c=source.index.getX(i+2);
  if(torsoOrLeg[a]&&torsoOrLeg[b]&&torsoOrLeg[c]){triangles.push(a,b,c);used.add(a);used.add(b);used.add(c);}
}
const geometry=new BufferGeometry(), vertices=new Float32BufferAttribute(new Float32Array(position.count*3),3);
geometry.setAttribute('position',vertices);geometry.setIndex(triangles);
const point=new Vector3(), ray=new Ray(), directions=[new Vector3(1,0,0),new Vector3(0,0,1)];
function queryGarment(){
  runtime.body.refresh();
  for(const i of used){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);vertices.setXYZ(i,point.x,point.y,point.z);}
  const tree=new MeshBVH(geometry,{indirect:true});let count=0,maximum=0,side=null;
  for(const [name,{mesh:hand}] of Object.entries(runtime.hands.hands)){
    for(let i=0;i<hand.geometry.attributes.position.count;i++){
      hand.getVertexPosition(i,ray.origin).applyMatrix4(hand.matrixWorld);
      let signedInside=true, crossings=0, distance=Infinity;
      for(const dir of directions){
        ray.direction.copy(dir);const plus=tree.raycastFirst(ray,DoubleSide);
        ray.direction.copy(dir).negate();const minus=tree.raycastFirst(ray,DoubleSide);
        if(!plus||!minus)continue;
        if(plus.face.normal.dot(dir)<=0||minus.face.normal.dot(dir)>=0){signedInside=false;break;}
        crossings++;distance=Math.min(distance,plus.distance,minus.distance);
      }
      if(signedInside&&crossings&&distance>.0003){
        count++;if(distance>maximum){maximum=distance;side=name;}
      }
    }
  }
  return {count,depthMm:maximum*1000,side};
}

const report={method:'all hand vertices; paired oriented ray crossings against deformed torso and trouser triangles; 0.3 mm threshold',
  triangles:triangles.length/3,samples:0,rows:[],beforeMaxMm:0,afterMaxMm:0,solveMeanMs:0};
try{
  if(process.argv.includes('--jump-only')){
    const host=new Group(), camera=new PerspectiveCamera();
    host.add(runtime.root);host.rotation.y=.8;camera.position.set(3,2,5);
    const jump={method:report.method,frames:0,retargetedFrames:0,maxGarmentDepthMm:0,maxProxyDepthMm:0};
    for(let i=0;i<94;i++){
      const t=i/60, y=Math.max(0,5.6*t-9.4*t*t), vy=5.6-18.8*t, air=i>0&&y>0;
      host.position.set(.02*i,y,0);
      runtime.update(1/60,{camera,pose:{position:host.position.toArray(),velocity:[1.2,air?vy:0,0],yaw:.8,mode:'grounded'},
        locomotion:{state:air?(vy>0?'jump':'fall'):'idle',grounded:!air,horizontalSpeed:air?1.2:0,verticalSpeed:air?vy:0}});
      if(runtime.body.getStatus().activeMotionSource==='V2-jump-retargeted-to-V1')jump.retargetedFrames++;
      jump.frames++;
      const measure=runtime.handContact.measure(true);
      jump.maxProxyDepthMm=Math.max(jump.maxProxyDepthMm,measure.left.penetration*1000,measure.right.penetration*1000);
      jump.maxGarmentDepthMm=Math.max(jump.maxGarmentDepthMm,queryGarment().depthMm);
    }
    if(process.argv[2]&&!process.argv[2].startsWith('--'))await writeFile(process.argv[2],JSON.stringify(jump,null,2)+'\n');
    console.log(JSON.stringify(jump,null,2));
  }else{
  for(const pose of ['relaxed','open','fist','point','pinch']){
    runtime.setHandPose(pose);runtime.hands.update(1);
    for(const [clip,animation] of runtime.body.clips){
      const row={pose,clip,before:{depthMm:0},after:{depthMm:0}};
      for(let i=0;i<=12;i++){
        const seconds=animation.duration*i/12;
        runtime.handContact.restore(true);runtime.body.sample(clip,seconds);runtime.hands.update(0);
        const before=queryGarment(), start=performance.now();
        runtime.handContact.solve(0);
        report.solveMeanMs+=performance.now()-start;
        const after=queryGarment();report.samples++;
        if(before.depthMm>row.before.depthMm)row.before={...before,seconds};
        if(after.depthMm>row.after.depthMm)row.after={...after,seconds};
      }
      report.beforeMaxMm=Math.max(report.beforeMaxMm,row.before.depthMm);
      report.afterMaxMm=Math.max(report.afterMaxMm,row.after.depthMm);
      report.rows.push(row);
    }
  }
  report.solveMeanMs/=report.samples;
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,rows:report.rows.filter(r=>r.after.depthMm>.3)},null,2));
  }
}finally{geometry.dispose();runtime.dispose();}
