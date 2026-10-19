import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname,join,resolve,relative,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'releases/avatar-web-v2-0.1.1');
const inside=relative(root,output);
if(inside.startsWith('..')||isAbsolute(inside))throw new Error('release_path_outside_workspace');
try{await fs.access(output);throw new Error('release_already_exists_use_a_new_reviewed_destination');}
catch(error){if(error.code!=='ENOENT')throw error;}
const blocked=new Set(['node_modules','.git','.claude','__pycache__']);
async function copy(from,to){
  const info=await fs.lstat(from),name=from.split(/[\\/]/).at(-1);
  if(blocked.has(name)||name==='.env'||name.startsWith('.env.')||name.endsWith('.log'))return;
  if(info.isSymbolicLink())throw new Error('release_symlink_refused:'+from);
  if(info.isDirectory()){
    await fs.mkdir(to,{recursive:true});
    for(const name of (await fs.readdir(from)).sort())await copy(join(from,name),join(to,name));
  }else{await fs.mkdir(dirname(to),{recursive:true});await fs.copyFile(from,to);}
}
const plugin=['src','scripts','tests','dist','assets-source','.agents','AGENTS.md','CLAUDE.md',
  '.gitignore','al-amr.plugin.json','alamr.d.ts','package.json','package-lock.json',
  'tsconfig.json','plugin-icon.png','README.md','integration.md','CHANGELOG.md',
  'LICENSE','CODE-LICENSE.txt','THIRD_PARTY_NOTICES.md'];
const host=['src','scripts','tests','.agents','AGENTS.md','CLAUDE.md','al-amr.environment.json',
  'alamr.d.ts','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html'];
for(const name of plugin)await copy(join(root,'آواتار',name),join(output,'آواتار',name));
for(const name of host)await copy(join(root,'avatar-lab',name),join(output,'avatar-lab',name));
await copy(join(root,'avatar-lab/public/environment-cover.png'),join(output,'avatar-lab/public/environment-cover.png'));
await copy(join(root,'avatar-lab/.al-amr/docs'),join(output,'avatar-lab/.al-amr/docs'));
await copy(join(root,'docs/releases/v2.0/DELIVERY_FA.md'),join(output,'README_FA.md'));
for(const name of ['plugin-tests.json','host-tests.json','plugin-validate.json','plugin-project-doctor.json',
  'plugin-publish-doctor.json','host-validate.json','runtime-equivalence.json','preservation.json'])
  await copy(join(root,'docs/releases/v2.0/preparation',name),join(output,'verification',name));
const manifest=JSON.parse(await fs.readFile(join(root,'آواتار/al-amr.plugin.json'),'utf8'));
if(manifest.version!=='0.1.1')throw new Error('unexpected_release_version');
const doctor=JSON.parse(await fs.readFile(join(output,'verification/plugin-publish-doctor.json'),'utf8'));
const artifact=doctor.data.checks.find(check=>check.id==='ALAMR_DOCTOR_PLUGIN_ARTIFACT');
if(!artifact?.ok)throw new Error('release_artifact_has_not_passed');
const pluginTests=JSON.parse(await fs.readFile(join(output,'verification/plugin-tests.json'),'utf8'));
const hostTests=JSON.parse(await fs.readFile(join(output,'verification/host-tests.json'),'utf8'));
if(pluginTests.exitCode!==0||hostTests.exitCode!==0||Number(pluginTests.failed)!==0||Number(hostTests.failed)!==0)throw new Error('release_tests_have_not_passed');
const metadata={format:1,clientDate:'2026-10-17',productGeneration:'2.0',technicalVersion:manifest.version,
  pluginId:manifest.pluginId,publisher:manifest.publisher,slug:manifest.slug,
  pluginDirectory:'آواتار',sampleEnvironment:'avatar-lab',
  readiness:{localBuild:true,pluginTests:Number(pluginTests.passed),hostTests:Number(hostTests.passed),manifestValid:true,artifactValid:true,
    artifactSizeWithin25MiB:true,registryVersionHistoryVerified:false,cliAuthenticated:false,
    registrySubmitted:false,registryPublished:false,gitCommitted:false,gitPushed:false},
  assetPermissions:{code:'MIT',avatarSourceScope:'non-commercial use',additionalCommercialOrPublicRedistributionPermissionVerified:false},
  omitted:['node_modules','local account/session state','generated sample Environment output'],
  authority:'Local prepared files; not an uploaded or immutable Registry candidate'};
await fs.writeFile(join(output,'release-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
await fs.writeFile(join(output,'.gitignore'),['**/node_modules/','**/.al-amr/*','!**/.al-amr/docs/',
  '**/.env','**/.env.*','!**/.env.example','**/.npmrc','*.log','*.tmp','*.tsbuildinfo',
  '/avatar-lab/dist/','/avatar-lab/public/avatar-v2/',''].join('\n'));
await fs.writeFile(join(output,'.gitattributes'),'* -text\n*.glb binary\n*.bin binary\n*.png binary\n*.jpg binary\n');
const files=[];
async function inspect(directory){for(const name of (await fs.readdir(directory)).sort()){
  const path=join(directory,name),info=await fs.lstat(path);
  if(info.isDirectory())await inspect(path);
  else{const bytes=await fs.readFile(path);files.push({path:relative(output,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
}}
await inspect(output);
await fs.writeFile(join(output,'release-inventory.json'),JSON.stringify({format:1,scope:'All delivery files except this inventory',files},null,2)+'\n');
for(const file of files){const bytes=await fs.readFile(join(output,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('release_readback_mismatch:'+file.path);}
console.log(JSON.stringify({code:'V2_RELEASE_PREPARED',path:output,version:manifest.version,files:files.length,
  totalBytes:files.reduce((sum,file)=>sum+file.bytes,0),artifactValid:true,registrySubmitted:false,gitPushed:false}));
