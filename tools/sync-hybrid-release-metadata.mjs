import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const write=async(path,value)=>fs.writeFile(new URL(path,root),JSON.stringify(value,null,2)+'\n');
const pkg=await json('آواتار/package.json');
if(pkg.version!=='0.1.2')throw new Error('Run the official single patch bump to 0.1.2 first');
const lock=await json('آواتار/package-lock.json');
lock.version=pkg.version;lock.packages[''].version=pkg.version;
await write('آواتار/package-lock.json',lock);
const host=await json('avatar-lab/package-lock.json');
host.packages['../آواتار'].version=pkg.version;
delete host.packages['../Avatar_V2_WebBase/AvatarRuntime'];
await write('avatar-lab/package-lock.json',host);
const test=new URL('آواتار/tests/package.test.mjs',root);
await fs.writeFile(test,(await fs.readFile(test,'utf8')).replace("pkg.version,'0.1.1'","pkg.version,'0.1.2'"));
const manifest=await json('آواتار/al-amr.plugin.json');
if(manifest.version!==pkg.version)throw new Error('Plugin versions differ');
manifest.shortDescription='آواتار ترکیبی وب با بدن، لباس و هشت حرکت V1، پرش V2 و چهرهٔ تازه با ۶۶ کانال بومی احساسات';
const adapter=manifest.frontendAdapters[0];
for(const name of ['AvatarHybrid','AVATAR_HYBRID_LEGACY_MODEL_URL','AVATAR_HYBRID_MODEL_URL','AVATAR_HYBRID_MOTIONS_URL','AVATAR_HYBRID_HEIGHT','AVATAR_HYBRID_TEXTURE_URL','createHybridRuntime'])
  if(!adapter.exports.includes(name))adapter.exports.push(name);
if(!adapter.composition.provides.some(value=>value.exportName==='AvatarHybrid'))
  adapter.composition.provides.unshift({exportName:'AvatarHybrid',surface:'avatar.character',description:'Accepted hybrid: V1 body, outfit and eight native clips, V2 jump and a sculpted native facial rig. Mount in the host-owned PlayerRig avatar prop.'});
await write('آواتار/al-amr.plugin.json',manifest);
console.log('0.1.2 metadata synchronized without another version bump');
