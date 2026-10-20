import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const kit=join(root,'releases/avatar-hybrid-0.1.2');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function check(base,files){for(const entry of files){const bytes=await fs.readFile(join(base,entry.path));if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw new Error('Delivery mismatch: '+entry.path);}}
const preparation=join(root,'docs/releases/hybrid-0.1.2/preparation');
const preservation=JSON.parse(await fs.readFile(join(preparation,'preservation.json'),'utf8'));
await check(join(root,'releases/avatar-web-v2-0.1.1'),preservation.previousReleaseFiles);
await check(join(root,'avatar-lab/dist-hybrid-test'),preservation.acceptedOutput);
await check(join(root,'avatar-lab/dist-hybrid-review'),preservation.acceptedInspectionOutput);
const inventory=JSON.parse(await fs.readFile(join(kit,'release-inventory.json'),'utf8'));
await check(kit,inventory.files);
let outputFiles=0,outputBytes=0;
async function compare(relative=''){
  const a=join(root,'avatar-lab/dist',relative),b=join(kit,'avatar-lab/dist',relative);
  const names=(await fs.readdir(a)).sort();
  if(JSON.stringify(names)!==JSON.stringify((await fs.readdir(b)).sort()))throw new Error('Host output file set mismatch: '+relative);
  for(const name of names){const next=join(relative,name);if((await fs.lstat(join(a,name))).isDirectory())await compare(next);else{
    const x=await fs.readFile(join(a,name)),y=await fs.readFile(join(b,name));if(!x.equals(y))throw new Error('Host output bytes differ: '+next);outputFiles++;outputBytes+=x.length;
  }}
}await compare();
const receipt={format:1,clientDate:'2026-10-20',scope:'Separate transferable kit installed and built without repository experiments or source folders',
  observedCommands:[
    {directory:'آواتار',command:'npm ci --offline --ignore-scripts --no-audit --fund=false',exitCode:0,installedPackages:24},
    {directory:'آواتار',command:'npm run build',exitCode:0},
    {directory:'آواتار',command:'npm test',exitCode:0,passed:26,failed:0},
    {directory:'avatar-lab',command:'npm ci --offline --ignore-scripts --no-audit --fund=false',exitCode:0,installedPackages:84},
    {directory:'avatar-lab',command:'npm test',exitCode:0,passed:12,failed:0},
    {directory:'avatar-lab',command:'npm run build',exitCode:0}
  ],
  packagingFix:'Preview exits on jump button and all official movement/flight keys before normal locomotion resumes; included in12 host tests.',
  productionOutput:{byteIdentical:true,files:outputFiles,bytes:outputBytes},
  initialKitReadback:{passed:true,files:inventory.files.length},
  preserved:{previousReleaseFiles:preservation.previousReleaseFiles.length,acceptedNormalFiles:preservation.acceptedOutput.length,acceptedInspectionFiles:preservation.acceptedInspectionOutput.length},
  installNote:'Initial sandbox offline cache lacked zustand. The real local npm cache was used successfully with network and lifecycle scripts disabled.',
  visualTestsRepeated:false,registrySubmitted:false,registryPublished:false,
  limits:'Command results are recorded from the actual preparation run; this script itself verifies stored files and both generated outputs. This is not a new Desktop rendering or Registry installation claim.'};
await fs.writeFile(join(preparation,'portable-copy.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
