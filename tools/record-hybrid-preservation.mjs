import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(base){const files=[];async function visit(dir){for(const name of (await fs.readdir(dir)).sort()){
  const path=join(dir,name),info=await fs.lstat(path);
  if(info.isSymbolicLink())throw new Error('Preservation refuses symlink: '+path);
  if(info.isDirectory())await visit(path);else{const bytes=await fs.readFile(path);files.push({path:relative(base,path).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)});}
}}await visit(base);return files;}
const accepted=JSON.parse(await fs.readFile(join(root,'آواتار/src/hybrid/accepted-source.json'),'utf8'));
for(const file of accepted.files){const path=file.file==='legacy-materials.mjs'?'avatar-lab/src/legacy-preview.mjs':'avatar-lab/experiments/hybrid-v2-face/'+file.file;
  if(sha(await fs.readFile(join(root,path)))!==file.acceptedSourceSha256)throw new Error('Accepted source changed: '+path);
}
const sourceFiles=['source/Avatar_03/Avatar_03_Complete_Animations_Updated.glb','آواتار/assets-source/v1/avatar03.glb','آواتار/assets-source/web-v2/avatar.glb','آواتار/assets-source/web-v2/motions.json'];
const sources=[];for(const path of sourceFiles){const bytes=await fs.readFile(join(root,path));sources.push({path,bytes:bytes.length,sha256:sha(bytes)});}
const output=join(root,'docs/releases/hybrid-0.1.2/preparation');await fs.mkdir(output,{recursive:true});
const receipt={format:1,clientDate:'2026-10-20',acceptedByOwner:true,visualTestsRepeated:false,
  acceptance:'Owner accepted the observed hybrid phase2 and asked to prepare publication/Git. No additional aesthetic changes authorized.',
  prePortComparison:{previousRelease:'releases/avatar-web-v2-0.1.1/آواتار',files:91,byteIdenticalToPluginBeforePort:true,verifiedBeforeMutation:true},
  previousReleaseFiles:await inventory(join(root,'releases/avatar-web-v2-0.1.1')),
  acceptedRuntime:accepted,acceptedOutput:await inventory(join(root,'avatar-lab/dist-hybrid-test')),
  acceptedInspectionOutput:await inventory(join(root,'avatar-lab/dist-hybrid-review')),
  sources,baselineHead:'be8a7d81b1077e4c71013f26efb04b4a72bfd778',
  acceptedPreview:{id:'pv_39b6cdd6087d482599402d080ab7ed0b',digest:'sha256:229905b27ff8e6835e8fc829f9156f774e03ae272121d4a78e57c6829fc08951',sourceDate:'2026-10-19'},
  limits:'Inventories prove stored bytes and accepted-code fingerprints, not a fresh visual run of the packaged adapter.'};
await fs.writeFile(join(output,'preservation.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({acceptedSourceUnchanged:true,acceptedOutputFiles:receipt.acceptedOutput.length,previousReleaseFiles:receipt.previousReleaseFiles.length,sources}));
