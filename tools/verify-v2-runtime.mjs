import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
const baseline=new URL('Avatar_V2_WebBase/AvatarRuntime/src/',root),plugin=new URL('آواتار/src/web-v2/',root);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const modules={};
for(const name of ['animation.mjs','expressions.mjs','math.mjs','physics.mjs','runtime.mjs','runtime.d.mts']){
 const a=await fs.readFile(new URL(name,baseline)),b=await fs.readFile(new URL(name,plugin));
 if(!a.equals(b))throw new Error('runtime_changed:'+name);
 modules[name]={sha256:hash(b),byteIdenticalToReviewedRuntime:true};
}
let original=await fs.readFile(new URL('actor.mjs',baseline),'utf8');
const published=await fs.readFile(new URL('actor.mjs',plugin),'utf8');
original=original.split('/** Compatibility entry point for a standalone Three renderer.')[0];
original=original.split('\n').filter(line=>!/^import.*(GLTFLoader|DRACOLoader|MeshoptDecoder)/.test(line)).join('\n');
if(original.trim()!==published.trim())throw new Error('actor_body_changed');
modules['actor.mjs']={sha256:hash(Buffer.from(published)),reviewedActorBodyUnchanged:true,omitted:'Unused standalone renderer/GLB-loader convenience entry only'};
const report={format:1,modules};
await fs.writeFile(new URL('docs/releases/v2.0/preparation/runtime-equivalence.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify({code:'REVIEWED_RUNTIME_PRESERVED',modules:Object.keys(modules).length}));
