import {BufferAttribute,Matrix4,Quaternion,Vector3} from 'three';

// Refine only the low-resolution scalp before the smooth identity warp.
// Every attribute and facial endpoint is interpolated; eyelids/lips are untouched.
export function refineScalp(runtime){
  const head=runtime.face.bindings.find(b=>b.node.name==='AvatarHead').node;
  const bone=head.skeleton.bones.find(b=>b.name==='Head');
  runtime.previewClip('Stand');runtime.seekClip(0);runtime.root.updateWorldMatrix(true,true);
  const inverse=new Matrix4().compose(bone.getWorldPosition(new Vector3()),bone.getWorldQuaternion(new Quaternion()),new Vector3(1,1,1)).invert();
  const original=head.geometry,g=original.clone(),p=new Vector3();
  const eligible=[];
  for(let i=0;i<g.attributes.position.count;i++){
    // Use the neutral base, not getVertexPosition (which includes the live
    // blink/micro-expression at the instant the clothing texture resolves).
    p.fromBufferAttribute(original.attributes.position,i);head.applyBoneTransform(i,p);
    eligible.push(p.applyMatrix4(head.matrixWorld).applyMatrix4(inverse).y>.084);
  }
  for(let pass=0;pass<2;pass++){
    const attrs=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{source:a,values:Array.from(a.array)}]));
    const morphs=Object.fromEntries(Object.entries(g.morphAttributes).map(([k,list])=>[k,list.map(a=>({source:a,values:Array.from(a.array)}))]));
    const cache=new Map(),indices=[];
    const midpoint=(a,b)=>{
      const key=a<b?a+':'+b:b+':'+a;if(cache.has(key))return cache.get(key);
      const id=eligible.length;eligible.push(eligible[a]||eligible[b]);cache.set(key,id);
      for(const [name,attr] of Object.entries(attrs)){
        const n=attr.source.itemSize;
        for(let j=0;j<n;j++)attr.values.push(name==='skinIndex'?attr.values[a*n+j]:(attr.values[a*n+j]+attr.values[b*n+j])*.5);
      }
      // The scalp uses Head but merge by bone ID rather than assuming order.
      const si=attrs.skinIndex,sw=attrs.skinWeight,weights=new Map();
      for(const v of [a,b])for(let k=0;k<4;k++)weights.set(si.values[v*4+k],(weights.get(si.values[v*4+k])??0)+sw.values[v*4+k]*.5);
      const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((s,p)=>s+p[1],0);
      for(let k=0;k<4;k++){si.values[id*4+k]=top[k]?.[0]??0;sw.values[id*4+k]=(top[k]?.[1]??0)/sum;}
      for(const list of Object.values(morphs))for(const a0 of list)for(let j=0;j<a0.source.itemSize;j++)a0.values.push((a0.values[a*a0.source.itemSize+j]+a0.values[b*a0.source.itemSize+j])*.5);
      return id;
    };
    for(let i=0;i<g.index.count;i+=3){
      const a=g.index.getX(i),b=g.index.getX(i+1),c=g.index.getX(i+2);
      if(!eligible[a]&&!eligible[b]&&!eligible[c]){indices.push(a,b,c);continue;}
      const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
      indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
    }
    for(const [name,{source,values}]of Object.entries(attrs))g.setAttribute(name,new BufferAttribute(new source.array.constructor(values),source.itemSize,source.normalized));
    for(const [name,list]of Object.entries(morphs))g.morphAttributes[name]=list.map(({source,values})=>new BufferAttribute(new source.array.constructor(values),source.itemSize,source.normalized));
    g.setIndex(indices);
  }
  head.geometry=g;
  return ()=>{head.geometry=original;g.dispose();};
}
