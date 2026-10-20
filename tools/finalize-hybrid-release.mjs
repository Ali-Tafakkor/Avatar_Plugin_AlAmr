// Finalize the unsubmitted local kit after a preparation review. Never use this
// to modify a Registry candidate or a previously delivered version.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join,resolve,relative,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const kit=resolve(root,'releases/avatar-hybrid-0.1.2');
if(relative(root,kit).startsWith('..')||isAbsolute(relative(root,kit)))throw new Error('Kit outside workspace');
const metadata=JSON.parse(await fs.readFile(join(kit,'release-metadata.json'),'utf8'));
if(metadata.technicalVersion!=='0.1.2'||metadata.operations.registryUpload!=='not performed by this tool')throw new Error('Unexpected kit state');
const normalized=[];
for(const name of execFileSync('git',['diff','--name-only','-z'],{cwd:root}).toString('utf8').split('\0').filter(Boolean)){
  if(name.startsWith('releases/')||name.startsWith('versions/')||name.startsWith('source/'))continue;
  let bytes;try{bytes=await fs.readFile(join(root,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const baseline=execFileSync('git',['show','HEAD:'+name],{cwd:root,maxBuffer:32*1024*1024});
  if(bytes.includes(0)||baseline.includes(0))continue;
  const desired=baseline.includes(Buffer.from('\r\n'))?'\r\n':'\n';
  const text=bytes.toString('utf8').replace(/\r?\n/g,desired);
  if(text!==bytes.toString('utf8')){await fs.writeFile(join(root,name),text);normalized.push(name);}
}
// Copy only known source/doc/test files from the production products. Assets,
// accepted experiments and previous releases are never changed here.
const inventoryPath=join(kit,'release-inventory.json');
const inventory=JSON.parse(await fs.readFile(inventoryPath,'utf8'));
for(const entry of inventory.files){
  if((entry.path.startsWith('آواتار/')||entry.path.startsWith('avatar-lab/'))
    && !entry.path.includes('/dist/') && !entry.path.includes('/assets-source/')
    && !entry.path.includes('/.agents/') && !entry.path.includes('/.al-amr/')
    && !entry.path.includes('/public/')){
    const from=join(root,entry.path);
    if((await fs.lstat(from)).isSymbolicLink())throw new Error('Source symlink refused');
    await fs.copyFile(from,join(kit,entry.path));
  }
}
// Reviewed control-transition helpers/tests may be newly added after first copy.
for(const folder of ['avatar-lab/src','avatar-lab/tests'])for(const name of await fs.readdir(join(root,folder))){
  if(/^(?:HybridTest|MotionTest)/.test(name)||name==='motion-test.css')continue;
  if(folder.endsWith('tests')&&!name.endsWith('.test.mjs'))continue;
  const path=folder+'/'+name;
  if((await fs.lstat(join(root,path))).isDirectory())continue;
  await fs.copyFile(join(root,path),join(kit,path));
  if(!inventory.files.some(entry=>entry.path===path))inventory.files.push({path});
}
for(const name of ['plugin-tests.json','host-tests.json','plugin-validate.json','plugin-project-doctor.json','plugin-publish-doctor.json','host-validate.json','preservation.json','version-transition.json','portable-copy.json']){
  const from=join(root,'docs/releases/hybrid-0.1.2/preparation',name);
  try{await fs.copyFile(from,join(kit,'verification',name));}
  catch(error){if(error.code==='ENOENT'&&name==='portable-copy.json')continue;throw error;}
  const path='verification/'+name;if(!inventory.files.some(entry=>entry.path===path))inventory.files.push({path});
}
metadata.readiness.hostRepositoryTests=JSON.parse(await fs.readFile(join(kit,'verification/host-tests.json'),'utf8')).passed;
try{await fs.access(join(kit,'verification/portable-copy.json'));metadata.readiness.portableCopyReceiptIncluded=true;}catch{}
await fs.writeFile(join(kit,'release-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
for(const file of inventory.files){const bytes=await fs.readFile(join(kit,file.path));file.bytes=bytes.length;file.sha256=createHash('sha256').update(bytes).digest('hex');}
inventory.files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
inventory.scope='All prepared delivery files except this inventory; node_modules and generated host build/assets are excluded. Finalized locally before any Registry submission.';
await fs.writeFile(inventoryPath,JSON.stringify(inventory,null,2)+'\n');
for(const file of inventory.files){const bytes=await fs.readFile(join(kit,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Readback failed: '+file.path);}
console.log(JSON.stringify({version:'0.1.2',files:inventory.files.length,normalizedTrackedText:normalized,registryAction:'none',kitReadback:true}));
