import {Bone,BufferGeometry,Color,Float32BufferAttribute,Matrix4,Quaternion,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3,Group} from 'three';
import {MeshPhysicalNodeMaterial} from 'three/webgpu';
import {LEGACY_HAND_SKIN_TRIANGLES,LEGACY_VERTEX_COUNT} from './hand-skin-mask.mjs';

const V=()=>new Vector3(), Q=()=>new Quaternion();
const clean=n=>n.toLowerCase().replace(/mixamorig|[^a-z0-9]/g,'');
const DIGITS=['thumb','index','middle','ring','pinky'];
const PRESETS={open:[0,0,0,0,0],relaxed:[.22,.16,.18,.21,.24],fist:[.65,.92,.95,.95,.92],point:[.42,0,.85,.9,.9],pinch:[.40,.40,.12,.18,.24]};
function palmFrame(wrist,index,thumb){
  const inverse=wrist.matrixWorld.clone().invert();
  const y=index.getWorldPosition(V()).applyMatrix4(inverse).normalize();
  const radial=thumb.getWorldPosition(V()).applyMatrix4(inverse).normalize();
  const z=y.clone().cross(radial).normalize(), x=y.clone().cross(z).normalize();
  z.crossVectors(x,y).normalize();
  return {q:Q().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z)),normal:z,radial:x};
}
function weightsAt(g,skeleton,index,side,remap){
  const result=new Map();
  for(let c=0;c<4;c++){
    const old=g.attributes.skinIndex.getComponent(index,c), w=g.attributes.skinWeight.getComponent(index,c);
    if(w>0){const next=remap?.get(old)??0;result.set(next,(result.get(next)??0)+w);}
  }
  return result;
}
function compactWeights(entries){
  const values=[...entries].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=values.reduce((v,p)=>v+p[1],0);
  const i=[0,0,0,0],w=[0,0,0,0];values.forEach(([bone,weight],c)=>{i[c]=bone;w[c]=weight/sum;});return {i,w};
}
// One Loop refinement of the authored hand. UV seams share positional neighbours;
// UVs remain registered, and skin weights follow the same interpolation as shape.
function refine(vertices,triangles){
  const weld=new Map(), ids=[],unique=[],neighbours=[],edgeMap=new Map();
  vertices.forEach(v=>{const key=v.p.map(x=>x.toFixed(6)).join(',');let id=weld.get(key);if(id===undefined){id=unique.length;weld.set(key,id);unique.push(v);neighbours.push(new Set());}ids.push(id);});
  const key=(a,b)=>a<b?a+':'+b:b+':'+a;
  for(let t=0;t<triangles.length;t+=3){const [a,b,c]=triangles.slice(t,t+3).map(i=>ids[i]);for(const [x,y,z] of [[a,b,c],[b,c,a],[c,a,b]]){if(x===y)continue;neighbours[x].add(y);neighbours[y].add(x);const k=key(x,y);if(!edgeMap.has(k))edgeMap.set(k,{a:x,b:y,op:[]});edgeMap.get(k).op.push(z);}}
  const blend=terms=>{
    const p=[0,0,0],weights=new Map();for(const [id,factor] of terms){const v=unique[id];for(let j=0;j<3;j++)p[j]+=v.p[j]*factor;for(const [i,w] of v.weights)weights.set(i,(weights.get(i)??0)+w*factor);}return {p,weights};
  };
  const evens=unique.map((v,i)=>{
    const ns=[...neighbours[i]],boundary=ns.filter(n=>edgeMap.get(key(i,n)).op.length===1);
    if(ns.length===0)return blend([[i,1]]);
    if(boundary.length===2)return blend([[i,.75],...boundary.map(n=>[n,.125])]);
    const beta=ns.length===3?3/16:3/(8*ns.length);return blend([[i,1-ns.length*beta],...ns.map(n=>[n,beta])]);
  });
  const out=vertices.map((v,i)=>({...evens[ids[i]],uv:v.uv})),midpoints=new Map(),indices=[];
  function mid(a,b){const k=key(a,b);if(midpoints.has(k))return midpoints.get(k);const e=edgeMap.get(key(ids[a],ids[b]));
    const terms=e?.op.length===2?[[ids[a],.375],[ids[b],.375],...e.op.map(i=>[i,.125])]:[[ids[a],.5],[ids[b],.5]];
    const v=blend(terms);v.uv=vertices[a].uv.map((x,j)=>(x+vertices[b].uv[j])*.5);const n=out.length;out.push(v);midpoints.set(k,n);return n;}
  for(let t=0;t<triangles.length;t+=3){const [a,b,c]=triangles.slice(t,t+3),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);indices.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}
  return {vertices:out,indices};
}

/** Full five-finger donor topology and private 21-joint branch per hand.
 * Mounts follow the native body wrists. No body/garment positions are rewritten. */
export function createDetailedHands(body,donor,{subdivide=true}={}){
  body.refresh();donor.restore();donor.root.updateMatrixWorld(true);
  const source=donor.meshes.find(m=>m.name==='AvatarBody');
  if(!source?.isSkinnedMesh)throw new Error('detailed_hand_source_missing');
  // Wrist-to-first-knuckle distances in the old rig are not hand lengths.
  // Measure the original visible hand skin instead. The old right hand is
  // partly closed, so use the larger open-hand reach for a symmetric pair.
  const percentile=(values,fraction)=>values.sort((a,b)=>a-b)[Math.floor((values.length-1)*fraction)];
  const oldSkinVertices=new Set([...LEGACY_HAND_SKIN_TRIANGLES].flatMap(t=>t.split(':').map(Number)));
  const referenceReach={};
  for(const side of ['left','right']){
    const wrist=body.bones.get(side+'hand').getWorldPosition(V()),distances=[];
    for(const mesh of body.meshes.filter(m=>m.isSkinnedMesh&&m.geometry.attributes.position.count===LEGACY_VERTEX_COUNT)){
      const g=mesh.geometry;
      for(const i of oldSkinVertices){let weight=0;for(let c=0;c<4;c++)if(clean(mesh.skeleton.bones[g.attributes.skinIndex.getComponent(i,c)].name).startsWith(side+'hand'))weight+=g.attributes.skinWeight.getComponent(i,c);
        if(weight>.05)distances.push(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).distanceTo(wrist));}
    }
    if(!distances.length)throw new Error('detailed_hand_reference_size_missing');
    referenceReach[side]=percentile(distances,.98);
  }
  const targetReach=Math.max(referenceReach.left,referenceReach.right);
  const hands={},removed=[],ownedMaterials=new Set();
  for(const side of ['left','right']){
    const wrist=body.bones.get(side+'hand'), sourceWrist=donor.bones.get(side+'hand');
    // The old two-chain rig's "Index1" drives its whole four-finger block.
    // Match the donor's actual central metacarpal, not its radial index ray.
    const refIndex=body.bones.get(side+'handindex1'), srcIndex=donor.bones.get(side+'handmiddle1');
    const targetFrame=palmFrame(wrist,refIndex,body.bones.get(side+'handthumb1'));
    const sourceFrame=palmFrame(sourceWrist,srcIndex,donor.bones.get(side+'handthumb1'));
    const inverseSource=sourceWrist.matrixWorld.clone().invert(), inverseTarget=wrist.matrixWorld.clone().invert();
    const targetLength=refIndex.getWorldPosition(V()).applyMatrix4(inverseTarget).length();
    const sourceLength=srcIndex.getWorldPosition(V()).applyMatrix4(inverseSource).length();
    const mount=new Group();mount.name='Detailed'+side+'HandMount';mount.scale.setScalar(targetLength/sourceLength);
    mount.quaternion.copy(targetFrame.q).multiply(sourceFrame.q.clone().invert());wrist.add(mount);
    const handRoot=new Bone();handRoot.name=side+'DetailedHand';
    for(const child of sourceWrist.children)handRoot.add(child.clone(true));
    const bones=[],byName=new Map();handRoot.traverse(n=>{if(n.isBone){bones.push(n);byName.set(clean(n.name),n);}});
    const remap=new Map();source.skeleton.bones.forEach((b,i)=>{const n=clean(b.name),next=n===side+'hand'?handRoot:byName.get(n);if(next)remap.set(i,bones.indexOf(next));});
    const g=source.geometry,selected=[],oldToNew=new Map(),verts=[];
    const handWeight=i=>{let total=0;for(let c=0;c<4;c++)if(clean(source.skeleton.bones[g.attributes.skinIndex.getComponent(i,c)].name).startsWith(side+'hand'))total+=g.attributes.skinWeight.getComponent(i,c);return total;};
    const vertex=i=>{if(oldToNew.has(i))return oldToNew.get(i);const p=source.getVertexPosition(i,V()).applyMatrix4(source.matrixWorld).applyMatrix4(inverseSource);
      const n=verts.length;oldToNew.set(i,n);verts.push({p:p.toArray(),uv:[g.attributes.uv.getX(i),g.attributes.uv.getY(i)],weights:weightsAt(g,source.skeleton,i,side,remap)});return n;};
    for(let t=0;t<g.index.count;t+=3){const tri=[0,1,2].map(c=>g.index.getX(t+c));if(tri.every(i=>handWeight(i)>.05))selected.push(...tri.map(vertex));}
    const data=subdivide?refine(verts,selected):{vertices:verts,indices:selected};
    const sourceReach=percentile(data.vertices.map(v=>V().fromArray(v.p).length()),.98);
    const wristWorldScale=wrist.getWorldScale(V()).x;
    mount.scale.setScalar(targetReach/(sourceReach*wristWorldScale));
    const positions=[],uvs=[],skinIndices=[],skinWeights=[];
    for(const v of data.vertices){positions.push(...v.p);uvs.push(...v.uv);const a=compactWeights(v.weights);skinIndices.push(...a.i);skinWeights.push(...a.w);}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
    geometry.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(skinWeights,4));geometry.setIndex(data.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    // Average normals across duplicated UV-seam vertices after refinement.
    const normals=geometry.attributes.normal,sums=new Map(),keys=[];
    for(let i=0;i<positions.length/3;i++){const key=positions.slice(i*3,i*3+3).map(v=>v.toFixed(6)).join(',');keys.push(key);if(!sums.has(key))sums.set(key,V());sums.get(key).add(V().fromBufferAttribute(normals,i));}
    for(let i=0;i<keys.length;i++){const n=sums.get(keys[i]).normalize();normals.setXYZ(i,n.x,n.y,n.z);}normals.needsUpdate=true;
    // The donor body atlas visibly breaks across the back of the right hand.
    // Use continuous local-space skin shading instead of sampling that atlas.
    // Per-vertex palm tint follows skinning and never changes hand geometry.
    const palmNormal=sourceFrame.normal.clone().multiplyScalar(side==='right'?-1:1);
    const palm=[];for(let i=0;i<normals.count;i++)palm.push(Math.max(0,V().fromBufferAttribute(normals,i).dot(palmNormal)));
    const colors=[],backColor=new Color('#bd9071'),palmColor=new Color('#d2af98');
    for(let i=0;i<palm.length;i++){
      const p=positions.slice(i*3,i*3+3),variation=1+.008*Math.sin(p[0]*95+p[1]*87+p[2]*73);
      const c=backColor.clone().lerp(palmColor,palm[i]*.35).multiplyScalar(variation);colors.push(c.r,c.g,c.b);
    }
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    const material=new MeshPhysicalNodeMaterial({vertexColors:true,roughness:.60,metalness:0,ior:1.4,specularIntensity:.28});
    material.name='DetailedHandSkinContinuous';material.side=source.material.side;
    ownedMaterials.add(material);
    const mesh=new SkinnedMesh(geometry,material);mesh.name=side==='left'?'DetailedLeftHand':'DetailedRightHand';mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mount.add(mesh);mesh.add(handRoot);
    body.root.updateMatrixWorld(true);const skeleton=new Skeleton(bones);mesh.bind(skeleton);mesh.normalizeSkinWeights();
    const joints=[];
    const middleDirection=byName.get(side+'handmiddle2').getWorldPosition(V()).sub(byName.get(side+'handmiddle1').getWorldPosition(V())).normalize();
    for(const digit of DIGITS)for(let j=1;j<=3;j++){
      const bone=byName.get(side+'hand'+digit+j), child=byName.get(side+'hand'+digit+(j+1));
      if(!bone||!child)throw new Error('detailed_hand_chain_missing:'+side+digit+j);
      const longitudinal=child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize();
      const normal=sourceFrame.normal.clone().multiplyScalar(side==='right'?-1:1).transformDirection(mount.matrixWorld);
      // Axis d x palmNormal bends the phalanx towards the palm on both sides.
      const axis=longitudinal.clone().cross(normal).normalize().applyQuaternion(bone.getWorldQuaternion(Q()).invert());
      const from=longitudinal.clone().addScaledVector(normal,-longitudinal.dot(normal)).normalize();
      const to=middleDirection.clone().addScaledVector(normal,-middleDirection.dot(normal)).normalize();
      const spreadAngle=j===1?Math.atan2(normal.dot(from.clone().cross(to)),from.dot(to))*(digit==='thumb'?.42:.85):0;
      const spreadAxis=normal.clone().applyQuaternion(bone.getWorldQuaternion(Q()).invert());
      joints.push({bone,axis,spreadAxis,spreadAngle,spread:0,rest:bone.quaternion.clone(),digit,segment:j,weight:0});
    }
    hands[side]={mount,mesh,skeleton,root:handRoot,joints,bones:byName,viewNormal:sourceFrame.normal,pose:'auto',overrides:{},stats:{vertices:geometry.attributes.position.count,triangles:geometry.index.count/3,joints:bones.length,articulatedJoints:joints.length,scale:mount.scale.x,referenceReachMeters:targetReach,legacyReachBySide:referenceReach,sizeCalibration:'symmetric size from the original open hand surface'}};
  }
  // Remove only triangles classified as hand skin in the original UV atlas.
  // Cuff/garment triangles with the same wrist weights remain untouched.
  for(const mesh of body.meshes.filter(m=>m.isSkinnedMesh)){
    const g=mesh.geometry;if(g.attributes.position.count!==LEGACY_VERTEX_COUNT)continue;
    const old=g.index.clone(),keep=[];let count=0;
    for(let i=0;i<old.count;i+=3){const tri=[old.getX(i),old.getX(i+1),old.getX(i+2)];if(LEGACY_HAND_SKIN_TRIANGLES.has(tri.join(':'))){count++;continue;}keep.push(...tri);}
    if(count){g.setIndex(keep);removed.push({mesh,index:old,triangles:count});}
  }
  let disposed=false;
  const update=(dt=1/60)=>{
    if(disposed)return;
    for(const h of Object.values(hands)){
      const preset=PRESETS[h.pose==='auto'?'relaxed':h.pose]??PRESETS.relaxed;
      for(const joint of h.joints){const target=h.overrides[joint.digit]??preset[DIGITS.indexOf(joint.digit)];joint.weight+=(target-joint.weight)*(1-Math.exp(-Math.max(0,dt)*14));
        const limit=(joint.digit==='thumb'?[.60,.90,.85]:[1.20,1.48,.98])[joint.segment-1];
        const spreadTarget=joint.spreadAngle*(h.pose==='open'?.55:1);joint.spread+=(spreadTarget-joint.spread)*(1-Math.exp(-Math.max(0,dt)*14));
        joint.bone.quaternion.copy(joint.rest).multiply(Q().setFromAxisAngle(joint.spreadAxis,joint.spread)).multiply(Q().setFromAxisAngle(joint.axis,joint.weight*limit));}
    }
  };
  update(1);
  return {hands,meshes:Object.values(hands).map(h=>h.mesh),update,
    setPose(pose,side='both'){if(pose!=='auto'&&!PRESETS[pose])throw new Error('unknown_hand_pose');for(const [s,h]of Object.entries(hands))if(side==='both'||side===s){h.pose=pose;h.overrides={};}},
    setFinger(side,digit,value){if(!DIGITS.includes(digit)||!Number.isFinite(value))return;for(const [s,h]of Object.entries(hands))if(side==='both'||side===s)h.overrides[digit]=Math.max(0,Math.min(1,value));},
    getStatus(){return {enabled:!disposed,source:'existing AvatarBody authored topology and five-finger skeleton',removedLegacySkinTriangles:removed.reduce((n,r)=>n+r.triangles,0),hands:Object.fromEntries(Object.entries(hands).map(([s,h])=>[s,{...h.stats,pose:h.pose,overrides:{...h.overrides},curl:Object.fromEntries(DIGITS.map(d=>[d,h.joints.find(j=>j.digit===d).weight]))}]))};},
    dispose(){if(disposed)return;disposed=true;for(const h of Object.values(hands)){h.mount.removeFromParent();h.mesh.geometry.dispose();h.skeleton.dispose();}for(const r of removed)r.mesh.geometry.setIndex(r.index);for(const m of ownedMaterials)m.dispose();}
  };
}
