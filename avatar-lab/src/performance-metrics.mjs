export function summarizeSamples(samples){
  if(!samples.length)return null;
  const mean=k=>samples.reduce((n,s)=>n+(s[k]??0),0)/samples.length;
  const ordered=samples.map(s=>s.frameMs).sort((a,b)=>a-b);
  const gpu=samples.filter(s=>Number.isFinite(s.gpuMs));
  return {frames:samples.length,fps:1000/mean('frameMs'),frameMs:mean('frameMs'),p95Ms:ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*.95)-1)],cpuSubmitMs:mean('cpuSubmitMs'),avatarUpdateMs:mean('avatarUpdateMs'),gpuMs:gpu.length?gpu.reduce((n,s)=>n+s.gpuMs,0)/gpu.length:null};
}
export function inventoryAvatar(root){
  const geometry=new Set(),buffers=new Set(),textures=new Set(),skeletons=new Set(),bones=new Set();let triangles=0,vertices=0,geometryBytes=0,meshes=0,skinPaletteJoints=0;
  root?.traverseVisible(n=>{
    if(!n.isMesh)return;meshes++;
    const g=n.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;vertices+=g.attributes.position.count;
    if(!geometry.has(g)){geometry.add(g);for(const a of [...Object.values(g.attributes),...Object.values(g.morphAttributes).flat(),...(g.index?[g.index]:[])]){const b=(a.array??a.data?.array)?.buffer;if(b&&!buffers.has(b)){buffers.add(b);geometryBytes+=b.byteLength;}}}
    if(n.skeleton&&!skeletons.has(n.skeleton)){skeletons.add(n.skeleton);skinPaletteJoints+=n.skeleton.bones.length;for(const b of n.skeleton.bones)bones.add(b.uuid);}
    for(const m of Array.isArray(n.material)?n.material:[n.material])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
  });
  return {meshes,triangles,vertices,geometryBytes,textures:textures.size,skinnedJoints:bones.size,skinPaletteJoints};
}
