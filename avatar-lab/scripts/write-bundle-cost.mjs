import {readdir,stat,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
async function scan(dir){const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())files.push(...await scan(p));else if(e.isFile()&&e.name!=='asset-cost.json')files.push({file:relative(root,p).replaceAll('\\','/'),bytes:(await stat(p)).size});}return files;}
const files=await scan(root),select=prefixes=>{const subset=files.filter(f=>prefixes.some(p=>f.file.startsWith(p)));return {bytes:subset.reduce((n,f)=>n+f.bytes,0),files:subset.length,resources:subset};};
const report={schemaVersion:1,measuredAt:new Date().toISOString(),units:'bytes',model:select(['avatar-hybrid/','avatar-v2/','appearance/']),speech:select(['speech/']),bundle:{bytes:files.reduce((n,f)=>n+f.bytes,0),files:files.length},note:'Disk bytes. Model includes geometry, images and motion. Speech assets are optional runtime loads. GPU allocations and JS heap are measured separately in the live panel.'};
await writeFile(join(root,'asset-cost.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({code:'AVATAR_BUNDLE_COST_RECORDED',model:report.model.bytes,speech:report.speech.bytes,bundle:report.bundle.bytes}));
