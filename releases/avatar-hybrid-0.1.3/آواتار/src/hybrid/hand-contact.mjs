import { Matrix4, Quaternion, Vector3 } from 'three';

const SIDES = ['left', 'right'];
const vec = () => new Vector3();
const quat = () => new Quaternion();
const nameOf = bone => bone.name.toLowerCase().replace(/mixamorig|[^a-z0-9]/g, '');
const axes = [[1,0,0],[0,1,0],[0,0,1],[1,0,1],[1,0,-1],[1,1,0],[1,-1,0],[0,1,1],[0,1,-1]]
  .flatMap(a => [new Vector3(...a).normalize(),new Vector3(...a).normalize().negate()]);
const percentile = (values, q) => values.sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];

/** Fit small convex proxies to the visible Stand0 garment, then transport
 * them with the native skeleton. Their coordinates are reference-pose metres. */
function fitRegions(body, face, height) {
  body.refresh();
  const origin=body.root.getWorldPosition(vec()), rotation=body.root.getWorldQuaternion(quat());
  const ref=new Matrix4().compose(origin,rotation,new Vector3(1,1,1)), inverse=ref.clone().invert();
  const point=vec(), y=name=>body.bones.get(name).getWorldPosition(vec()).applyMatrix4(inverse).y;
  const u=height/1.78, hip=y('hips'), upper=y('spine1'), neck=y('neck');
  const torso=/^(hips|spine\d*|neck|leftshoulder|rightshoulder)$/;
  const definitions=[
    {name:'pelvis',bone:'hips',from:hip-.135*u,to:hip+.083*u,match:/^(hips|spine|leftupleg|rightupleg)$/},
    {name:'abdomen',bone:'spine',from:hip+.045*u,to:upper+.048*u,match:torso},
    {name:'chest',bone:'spine2',from:upper+.005*u,to:neck+.021*u,match:torso},
  ];
  for(const side of SIDES){
    const hipY=y(side+'upleg'), knee=y(side+'leg'), ankle=y(side+'foot');
    const middle=(hipY+knee)/2;
    const thigh=new RegExp('^'+side+'(upleg|leg)$');
    definitions.push(
      {name:side+'UpperThigh',bone:side+'upleg',from:middle-.042*u,to:hipY+.051*u,match:thigh},
      {name:side+'LowerThigh',bone:side+'upleg',from:knee-.037*u,to:middle+.041*u,match:thigh},
      {name:side+'Shin',bone:side+'leg',from:ankle-.017*u,to:knee+.045*u,match:thigh},
      {name:side+'UpperArm',bone:side+'arm',from:y(side+'forearm')-.035*u,to:y(side+'arm')+.084*u,match:new RegExp('^'+side+'(arm|forearm)$'),exclude:side},
      {name:side+'Forearm',bone:side+'forearm',from:y(side+'hand')-.022*u,to:y(side+'forearm')+.036*u,match:new RegExp('^'+side+'(forearm|hand)$'),exclude:side},
    );
  }
  const samples=definitions.map(()=>[]);
  for(const mesh of body.meshes) {
    if(!mesh.isSkinnedMesh || !mesh.geometry.index)continue;
    const {skinIndex,skinWeight}=mesh.geometry.attributes, names=mesh.skeleton.bones.map(nameOf);
    const indices=new Set(mesh.geometry.index.array);
    for(const i of indices){
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      for(let d=0;d<definitions.length;d++){
        const {from,to,match}=definitions[d];if(point.y<from||point.y>to)continue;
        let weight=0;
        for(let j=0;j<4;j++)if(match.test(names[skinIndex.getComponent(i,j)]))weight+=skinWeight.getComponent(i,j);
        if(weight>.58)samples[d].push(point.clone());
      }
    }
  }
  const head=face.bindings.find(b=>b.node.name==='AvatarHead')?.node;
  if(head){
    const points=[];
    for(let i=0;i<head.geometry.attributes.position.count;i+=3)
      points.push(head.getVertexPosition(i,vec()).applyMatrix4(head.matrixWorld).applyMatrix4(inverse));
    definitions.push({name:'head',bone:'head'});samples.push(points);
  }
  return definitions.flatMap(({name,bone,exclude},i)=>{
    const points=samples[i];if(points.length<12)return [];
    const joint=body.bones.get(bone), padding=.005*u;
    const limits=axes.map(axis=>percentile(points.map(p=>p.dot(axis)),.99)+padding);
    const restToBone=joint.matrixWorld.clone().invert().multiply(ref);
    return [{name,joint,exclude,limits,restToBone,forward:new Matrix4(),inverse:new Matrix4()}];
  });
}

// A spatially distributed subset of the real skinned hand, including thumb,
// finger ends and the palm. Keep different digit influences in the same voxel.
function handSamples(hand, height) {
  const geometry=hand.mesh.geometry,{position,skinIndex,skinWeight}=geometry.attributes;
  const step=.012*(height/1.78)/hand.mount.getWorldScale(vec()).x, seen=new Set(), indices=[];
  for(let i=0;i<position.count;i++){
    let owner=0, weight=-1;
    for(let c=0;c<4;c++)if(skinWeight.getComponent(i,c)>weight){weight=skinWeight.getComponent(i,c);owner=skinIndex.getComponent(i,c);}
    const key=[owner,...[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.floor(v/step))].join(':');
    if(!seen.has(key)){seen.add(key);indices.push(i);}
  }
  return indices;
}

/** A post-animation arm constraint; it never translates the wrist or scales
 * bones. Restore the previous base before the mixer evaluates another pose. */
export function createHandContact(body, hands, face, height=1.78) {
  const regions=fitRegions(body,face,height);
  if(!regions.length)return null;
  const arms=SIDES.map(side=>({
    side,hand:hands.hands[side],joint:body.bones.get(side+'arm'),base:quat(),offset:quat(),written:false,
    indices:handSamples(hands.hands[side],height),candidates:regions.filter(r=>r.exclude!==side),
    before:0,after:0,region:null,angle:0,
  }));
  const point=vec(), local=vec(), normal=vec(), hitPoint=vec(), pivot=vec(), axis=vec();
  const inverseParent=quat(), correction=quat(), identity=quat(), scaleVector=vec(), nearby=[];
  const goal=.003*(height/1.78), maxAngle=.37;
  function refreshRegions(){
    for(const r of regions){
      r.forward.multiplyMatrices(r.joint.matrixWorld,r.restToBone);r.inverse.copy(r.forward).invert();
      r.scale=scaleVector.setFromMatrixScale(r.forward).x;
    }
  }
  function deepest(arm, all=false){
    let penetration=0, selected=null;
    const mesh=arm.hand.mesh, count=all?mesh.geometry.attributes.position.count:arm.indices.length;
    point.setFromMatrixPosition(mesh.matrixWorld);
    const reach=.245*(height/1.78)*regions[0].scale;
    nearby.length=0;
    for(const r of arm.candidates){
      local.copy(point).applyMatrix4(r.inverse);
      const margin=reach/r.scale;let close=true;
      for(let j=0;j<6;j++)if(axes[j].dot(local)>=r.limits[j]+margin){close=false;break;}
      if(close)nearby.push(r);
    }
    if(!nearby.length)return {penetration:0,region:null};
    // Bone transforms are folded once per sample pass, rather than per vertex.
    const {position,skinIndex,skinWeight}=mesh.geometry.attributes, skeleton=mesh.skeleton;
    const transforms=arm.transforms??=skeleton.bones.map(()=>new Matrix4());
    for(let j=0;j<transforms.length;j++)transforms[j].multiplyMatrices(skeleton.bones[j].matrixWorld,skeleton.boneInverses[j]).multiply(mesh.bindMatrix);
    const p=arm.p??=vec(), q=arm.q??=vec();
    for(let k=0;k<count;k++){
      const i=all?k:arm.indices[k];p.fromBufferAttribute(position,i);point.set(0,0,0);
      for(let j=0;j<4;j++){const w=skinWeight.getComponent(i,j);if(w>0)point.addScaledVector(q.copy(p).applyMatrix4(transforms[skinIndex.getComponent(i,j)]),w);}
      for(const region of nearby){
        local.copy(point).applyMatrix4(region.inverse);
        let depth=Infinity, plane=0;
        for(let j=0;j<axes.length;j++){
          const d=region.limits[j]-axes[j].dot(local);
          if(d<=penetration){depth=0;break;}
          if(d<depth){depth=d;plane=j;}
        }
        if(depth>penetration){
          penetration=depth;selected=region;normal.copy(axes[plane]).transformDirection(region.forward);hitPoint.copy(point);
        }
      }
    }
    return {penetration,region:selected?.name??null,scale:selected?.scale??1};
  }
  function restore(clear=false){
    for(const a of arms){
      if(a.written){a.joint.quaternion.copy(a.base);a.written=false;}
      if(clear)a.offset.identity();
    }
  }
  function solve(dt){
    const release=1-Math.exp(-Math.max(0,Number.isFinite(dt)?dt:0)*13);
    for(const a of arms){
      a.base.copy(a.joint.quaternion);
      a.offset.slerp(identity,release);
      a.joint.quaternion.copy(a.base).premultiply(a.offset);a.written=true;
      a.joint.updateWorldMatrix(true,true);
    }
    refreshRegions();
    for(const a of arms){
      let hit=deepest(a);
      a.before=hit.penetration;a.region=hit.region;
      for(let step=0;step<8&&hit.penetration>.0003;step++){
        pivot.setFromMatrixPosition(a.joint.matrixWorld);
        axis.crossVectors(point.subVectors(hitPoint,pivot),normal);
        const leverage=axis.length();if(leverage<.025)break;
        // The rig uses uniform avatar scale. Convert the fitted metre depth
        // to the angular travel of the actual shoulder-to-contact lever.
        const amount=Math.min(.105,(hit.penetration+goal)*hit.scale/leverage);
        inverseParent.copy(a.joint.parent.getWorldQuaternion(correction)).invert();
        axis.multiplyScalar(1/leverage).applyQuaternion(inverseParent);
        correction.setFromAxisAngle(axis,amount);
        a.offset.premultiply(correction).normalize();
        const total=a.offset.angleTo(identity);
        if(total>maxAngle)a.offset.slerp(identity,1-maxAngle/total);
        a.joint.quaternion.copy(a.base).premultiply(a.offset);
        a.joint.updateWorldMatrix(false,true);refreshRegions();
        hit=deepest(a);
      }
      a.after=hit.penetration;a.angle=a.offset.angleTo(identity);
    }
  }
  return {restore,solve,
    measure(all=false){body.refresh();refreshRegions();return Object.fromEntries(arms.map(a=>[a.side,deepest(a,all)]));},
    getStatus(){return {regions:regions.length,hands:Object.fromEntries(arms.map(a=>[a.side,{before:a.before,after:a.after,region:a.region,angle:a.angle,samples:a.indices.length}]))};},
  };
}
