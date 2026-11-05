import {Matrix3,Matrix4,Vector3} from 'three';

const V=()=>new Vector3();
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** A continuous, gently tapered neck. Front jaw/beard and everything above the
 * under-ear transition stay native. The lower donor shoulder bib is tucked
 * radially, rather than leaving a side flange or a sharp hourglass indentation. */
export function contourNeckPoint(p,out=V()){
  const blend=(1-smooth(-.030,-.008,p.y))*(1-smooth(.072,.095,p.z));
  if(!blend)return out.copy(p);
  const rx=.051+.005*smooth(-.080,-.020,p.y)+.008*(1-smooth(-.130,-.075,p.y));
  const rz=.052+.006*smooth(-.080,-.015,p.y),cz=.004+.006*smooth(-.120,-.025,p.y);
  const rho=Math.hypot(p.x/rx,(p.z-cz)/rz);
  if(rho<1e-6)return out.copy(p);
  // Retain a small radial derivative so the warp stays invertible, including
  // its normal/Jacobian and the facial morph endpoint transforms.
  const scale=1+(1/rho-1)*blend*.92;
  return out.set(p.x*scale,p.y,cz+(p.z-cz)*scale);
}

export function vertexFrames(mesh,frame){
  mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
  const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  const prefix=frame.clone().invert().multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
  const bones=mesh.skeleton.bones.map((b,i)=>new Matrix4().multiplyMatrices(b.matrixWorld,mesh.skeleton.boneInverses[i]));
  return Array.from({length:g.attributes.position.count},(_,i)=>{
    const sum=new Array(16).fill(0);
    for(let c=0;c<4;c++){
      const w=sw.getComponent(i,c);if(!w)continue;
      const e=bones[si.getComponent(i,c)].elements;
      for(let k=0;k<16;k++)sum[k]+=w*e[k];
    }
    const matrix=prefix.clone().multiply(new Matrix4().fromArray(sum)).multiply(mesh.bindMatrix);
    const linear=new Matrix3().setFromMatrix4(matrix);
    return {matrix,linear,inverse:linear.clone().invert()};
  });
}

function normalWarp(record,p){
  const center=contourNeckPoint(p),eps=1e-5;
  const columns=[V().set(eps,0,0),V().set(0,eps,0),V().set(0,0,eps)]
    .map(v=>contourNeckPoint(p.clone().add(v)).sub(center).divideScalar(eps));
  const jacobian=new Matrix3().set(columns[0].x,columns[1].x,columns[2].x,
    columns[0].y,columns[1].y,columns[2].y,columns[0].z,columns[1].z,columns[2].z);
  return record.inverse.clone().multiply(jacobian).multiply(record.linear).invert().transpose();
}

export function refineNeckGeometry(mesh,frame){
  const g=mesh.geometry,positions=g.attributes.position,normals=g.attributes.normal;
  const morphs=g.morphAttributes.position??[],morphNormals=g.morphAttributes.normal??[];
  const records=vertexFrames(mesh,frame);let affected=0,maximum=0;
  for(let i=0;i<positions.count;i++){
    const record=records[i],local=V().fromBufferAttribute(positions,i),p=local.clone().applyMatrix4(record.matrix);
    const shaped=contourNeckPoint(p),shift=shaped.clone().sub(p);
    const baseChanged=shift.lengthSq()>=1e-16;
    if(baseChanged){affected++;maximum=Math.max(maximum,shift.length());}
    const updated=local.clone().add(shift.applyMatrix3(record.inverse));positions.setXYZ(i,...updated);
    const normal=normals&&V().fromBufferAttribute(normals,i);
    const updatedNormal=normal?.clone();
    if(baseChanged&&updatedNormal)updatedNormal.applyMatrix3(normalWarp(record,p)).normalize();
    if(updatedNormal)normals.setXYZ(i,...updatedNormal);
    for(let t=0;t<morphs.length;t++){
      const d=V().fromBufferAttribute(morphs[t],i);
      if(!g.morphTargetsRelative)d.sub(local);
      const endpoint=p.clone().add(d.applyMatrix3(record.linear));
      const target=contourNeckPoint(endpoint);
      if(!baseChanged&&target.distanceToSquared(endpoint)<1e-16)continue;
      const delta=target.sub(shaped).applyMatrix3(record.inverse);
      if(!g.morphTargetsRelative)delta.add(updated);
      morphs[t].setXYZ(i,...delta);
      if(morphNormals[t]&&normal){
        const endpointNormal=V().fromBufferAttribute(morphNormals[t],i);
        if(g.morphTargetsRelative)endpointNormal.add(normal);
        endpointNormal.applyMatrix3(normalWarp(record,endpoint)).normalize();
        if(g.morphTargetsRelative)endpointNormal.sub(updatedNormal);
        morphNormals[t].setXYZ(i,...endpointNormal);
      }
    }
  }
  for(const a of [positions,normals,...morphs,...morphNormals].filter(Boolean))a.needsUpdate=true;
  g.computeBoundingBox();g.computeBoundingSphere();
  return {method:'smooth elliptical under-ear contour; coherent position and normal morph endpoints',affectedVertices:affected,
    maximumDisplacementMeters:maximum,frontJawProtected:true};
}

